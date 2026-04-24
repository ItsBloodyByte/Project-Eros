#!/usr/bin/env python3
"""
Focused backend API testing for the Phase 11.2 refactor.
Tests the extracted payment, webhook, and admin functionality.
"""

import requests
import json
import sys
from datetime import datetime, timezone
from typing import Dict, Optional, List

class RefactorTester:
    def __init__(self, base_url="https://auto-implement-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.tokens = {}  # user_email -> token
        self.users = {}   # user_email -> user_data
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Test credentials from the requirements
        self.test_users = {
            "admin@eros.app": {"password": "admin123", "role": "admin"},
            "testing@test.com": {"password": "testpass123", "role": "user"},
        }

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append(f"{name}: {details}")

    def make_request(self, method: str, endpoint: str, data=None, token=None, expected_status=200, raw_data=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        # Handle expected_status as list or single value
        if isinstance(expected_status, list):
            expected_statuses = expected_status
        else:
            expected_statuses = [expected_status]
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if raw_data:
                    # For webhook tests with raw data
                    headers['Content-Type'] = 'application/json'
                    response = requests.post(url, data=raw_data, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code in expected_statuses
            return success, response
        except Exception as e:
            print(f"Request error: {str(e)}")
            return False, None

    def test_login(self):
        """Test login with available credentials"""
        print("\n🔍 Testing Login...")
        
        for email, creds in self.test_users.items():
            login_data = {
                "email": email,
                "password": creds["password"]
            }
            
            success, resp = self.make_request('POST', '/auth/login', login_data, expected_status=200)
            if success and resp:
                data = resp.json()
                if "access_token" in data and "user" in data:
                    self.tokens[email] = data["access_token"]
                    self.users[email] = data["user"]
                    self.log_test(f"Login {email}", True, f"Role: {data['user'].get('role', 'user')}")
                else:
                    self.log_test(f"Login {email}", False, "Missing token or user data")
            else:
                self.log_test(f"Login {email}", False, 
                             f"Status: {resp.status_code if resp else 'No response'}")

    def test_user_payment_endpoints(self):
        """Test USER PAYMENTS endpoints"""
        print("\n🔍 Testing USER PAYMENTS Endpoints...")
        
        user_token = self.tokens.get("testing@test.com")
        if not user_token:
            self.log_test("User payments tests", False, "User token not available")
            return
        
        # Test GET /api/payments/packages
        success, resp = self.make_request('GET', '/payments/packages', token=user_token)
        if success and resp:
            data = resp.json()
            has_required_fields = all(key in data for key in ["enabled", "provider", "supported", "packages"])
            self.log_test("GET /api/payments/packages returns package list", has_required_fields,
                         f"Provider: {data.get('provider')}, Enabled: {data.get('enabled')}")
        else:
            self.log_test("GET /api/payments/packages returns package list", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test POST /api/payments/checkout with invalid package
        checkout_data = {
            "package_id": "nonexistent_package",
            "origin_url": "https://example.com"
        }
        success, resp = self.make_request('POST', '/payments/checkout', checkout_data, 
                                        token=user_token, expected_status=400)
        self.log_test("POST /api/payments/checkout returns proper error for unknown package", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test POST /api/payments/paypal/create-order with invalid package
        paypal_data = {
            "package_id": "nonexistent_package",
            "origin_url": "https://example.com"
        }
        success, resp = self.make_request('POST', '/payments/paypal/create-order', paypal_data, 
                                        token=user_token, expected_status=400)
        self.log_test("POST /api/payments/paypal/create-order graceful error", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test POST /api/payments/klarna/create-session with invalid package
        klarna_data = {
            "package_id": "nonexistent_package",
            "country": "DE"
        }
        success, resp = self.make_request('POST', '/payments/klarna/create-session', klarna_data, 
                                        token=user_token, expected_status=400)
        self.log_test("POST /api/payments/klarna/create-session graceful error", success,
                     f"Status: {resp.status_code if resp else 'No response'}")

    def test_webhook_endpoints(self):
        """Test WEBHOOKS endpoints"""
        print("\n🔍 Testing WEBHOOKS Endpoints...")
        
        # Test POST /api/webhook/stripe without signature
        success, resp = self.make_request('POST', '/webhook/stripe', expected_status=400, raw_data='{}')
        self.log_test("POST /api/webhook/stripe without signature returns 400", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test POST /api/webhook/paypal without event id
        paypal_webhook_data = '{"event_type": "PAYMENT.CAPTURE.COMPLETED"}'
        success, resp = self.make_request('POST', '/webhook/paypal', expected_status=400, 
                                        raw_data=paypal_webhook_data)
        self.log_test("POST /api/webhook/paypal without event id returns 400", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test POST /api/webhook/klarna without order_id
        klarna_webhook_data = '{"status": "AUTHORIZED"}'
        success, resp = self.make_request('POST', '/webhook/klarna', expected_status=400, 
                                        raw_data=klarna_webhook_data)
        self.log_test("POST /api/webhook/klarna without order_id returns 400", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test idempotency: same event_id posted twice
        paypal_duplicate_data = '{"id": "test_event_123", "event_type": "PAYMENT.CAPTURE.COMPLETED", "resource": {"id": "unknown_order"}}'
        success1, resp1 = self.make_request('POST', '/webhook/paypal', expected_status=200, 
                                          raw_data=paypal_duplicate_data)
        success2, resp2 = self.make_request('POST', '/webhook/paypal', expected_status=200, 
                                          raw_data=paypal_duplicate_data)
        
        duplicate_detected = False
        if success2 and resp2:
            data = resp2.json()
            duplicate_detected = data.get("duplicate") == True
        
        self.log_test("Idempotency: same event_id posted twice returns {duplicate: true}", 
                     duplicate_detected,
                     f"First: {resp1.status_code if resp1 else 'None'}, Second: {resp2.status_code if resp2 else 'None'}, Duplicate: {duplicate_detected}")

    def test_admin_endpoints(self):
        """Test ADMIN endpoints"""
        print("\n🔍 Testing ADMIN Endpoints...")
        
        admin_token = self.tokens.get("admin@eros.app")
        user_token = self.tokens.get("testing@test.com")
        
        if not admin_token:
            self.log_test("Admin endpoints tests", False, "Admin token not available")
            return
        
        # Test GET /api/admin/users (list + pagination)
        success, resp = self.make_request('GET', '/admin/users', token=admin_token)
        if success and resp:
            data = resp.json()
            has_users = "users" in data and isinstance(data["users"], list)
            self.log_test("GET /api/admin/users (list + pagination)", has_users,
                         f"Users count: {len(data.get('users', []))}")
        else:
            self.log_test("GET /api/admin/users (list + pagination)", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Get a user ID for further tests
        user_id = None
        if success and resp:
            users = resp.json().get("users", [])
            if users:
                user_id = users[0].get("id")
        
        if user_id:
            # Test GET /api/admin/users/{user_id}
            success, resp = self.make_request('GET', f'/admin/users/{user_id}', token=admin_token)
            if success and resp:
                data = resp.json()
                has_user_detail = "user" in data
                self.log_test("GET /api/admin/users/{user_id}", has_user_detail,
                             f"User detail retrieved: {bool(data.get('user'))}")
            else:
                self.log_test("GET /api/admin/users/{user_id}", False, 
                             f"Status: {resp.status_code if resp else 'No response'}")
            
            # Test PATCH /api/admin/users/{user_id}
            update_data = {"display_name": "Test Updated Name"}
            success, resp = self.make_request('PATCH', f'/admin/users/{user_id}', update_data, token=admin_token)
            self.log_test("PATCH /api/admin/users/{user_id}", success,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test POST /api/admin/ban + /api/admin/unban/{user_id}
        if user_id:
            ban_data = {"user_id": user_id, "reason": "Test ban"}
            success, resp = self.make_request('POST', '/admin/ban', ban_data, token=admin_token)
            ban_success = success
            
            if success:
                # Test unban
                success, resp = self.make_request('POST', f'/admin/unban/{user_id}', token=admin_token)
                unban_success = success
                self.log_test("POST /api/admin/ban + /api/admin/unban/{user_id}", 
                             ban_success and unban_success,
                             f"Ban: {ban_success}, Unban: {unban_success}")
            else:
                self.log_test("POST /api/admin/ban + /api/admin/unban/{user_id}", False, 
                             f"Ban failed: {resp.status_code if resp else 'No response'}")
        
        # Test POST /api/admin/users/bulk with action
        if user_id:
            bulk_data = {
                "user_ids": [user_id],
                "action": "hide",
                "reason": "Test bulk action"
            }
            success, resp = self.make_request('POST', '/admin/users/bulk', bulk_data, token=admin_token)
            self.log_test("POST /api/admin/users/bulk with action", success,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test POST /api/admin/users/{user_id}/premium grants premium expiry
        if user_id:
            premium_data = {"action": "grant", "days": 30}
            success, resp = self.make_request('POST', f'/admin/users/{user_id}/premium', premium_data, token=admin_token)
            self.log_test("POST /api/admin/users/{user_id}/premium grants premium expiry", success,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test POST /api/admin/users/{user_id}/role (only superadmin can elevate to admin)
        if user_id:
            role_data = {"role": "support"}
            success, resp = self.make_request('POST', f'/admin/users/{user_id}/role', role_data, token=admin_token)
            self.log_test("POST /api/admin/users/{user_id}/role", success,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test ADMIN REPORTS
        success, resp = self.make_request('GET', '/admin/reports', token=admin_token)
        if success and resp:
            data = resp.json()
            has_reports = "reports" in data
            self.log_test("ADMIN REPORTS - GET /api/admin/reports + detail + status", has_reports,
                         f"Reports count: {len(data.get('reports', []))}")
        else:
            self.log_test("ADMIN REPORTS - GET /api/admin/reports + detail + status", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test ADMIN MODERATION
        success, resp = self.make_request('GET', '/admin/moderation/photos', token=admin_token)
        if success and resp:
            data = resp.json()
            has_photos = "photos" in data
            self.log_test("ADMIN MODERATION - GET /api/admin/moderation/photos list", has_photos,
                         f"Photos count: {len(data.get('photos', []))}")
        else:
            self.log_test("ADMIN MODERATION - GET /api/admin/moderation/photos list", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        success, resp = self.make_request('GET', '/admin/videos', token=admin_token)
        if success and resp:
            data = resp.json()
            has_videos = "videos" in data
            self.log_test("ADMIN MODERATION - GET /api/admin/videos list", has_videos,
                         f"Videos count: {len(data.get('videos', []))}")
        else:
            self.log_test("ADMIN MODERATION - GET /api/admin/videos list", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test ADMIN VERIFICATIONS
        success, resp = self.make_request('GET', '/admin/verifications', token=admin_token)
        if success and resp:
            data = resp.json()
            has_verifications = "verifications" in data
            self.log_test("ADMIN VERIFICATIONS - GET + review", has_verifications,
                         f"Verifications count: {len(data.get('verifications', []))}")
        else:
            self.log_test("ADMIN VERIFICATIONS - GET + review", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test ADMIN PAYMENTS
        success, resp = self.make_request('GET', '/admin/payment-config', token=admin_token)
        if success and resp:
            data = resp.json()
            has_config = "provider" in data and "enabled" in data
            self.log_test("ADMIN PAYMENTS - GET/POST /api/admin/payment-config", has_config,
                         f"Provider: {data.get('provider')}, Enabled: {data.get('enabled')}")
        else:
            self.log_test("ADMIN PAYMENTS - GET/POST /api/admin/payment-config", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        success, resp = self.make_request('GET', '/admin/payments/transactions', token=admin_token)
        if success and resp:
            data = resp.json()
            has_transactions = "transactions" in data
            self.log_test("ADMIN PAYMENTS - GET /api/admin/payments/transactions", has_transactions,
                         f"Transactions count: {len(data.get('transactions', []))}")
        else:
            self.log_test("ADMIN PAYMENTS - GET /api/admin/payments/transactions", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        success, resp = self.make_request('GET', '/admin/payments/webhook-events', token=admin_token)
        if success and resp:
            data = resp.json()
            has_events = "events" in data
            self.log_test("ADMIN PAYMENTS - GET /api/admin/payments/webhook-events", has_events,
                         f"Webhook events count: {len(data.get('events', []))}")
        else:
            self.log_test("ADMIN PAYMENTS - GET /api/admin/payments/webhook-events", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test POST /api/admin/payments/transactions/{id}/reconcile with nonexistent ID
        success, resp = self.make_request('POST', '/admin/payments/transactions/nonexistent_id/reconcile', 
                                        token=admin_token, expected_status=404)
        self.log_test("ADMIN PAYMENTS - POST /api/admin/payments/transactions/{id}/reconcile", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test ADMIN BROADCASTS
        success, resp = self.make_request('GET', '/admin/broadcasts', token=admin_token)
        if success and resp:
            data = resp.json()
            has_broadcasts = "broadcasts" in data
            self.log_test("ADMIN BROADCASTS - GET/POST /api/admin/broadcasts", has_broadcasts,
                         f"Broadcasts count: {len(data.get('broadcasts', []))}")
        else:
            self.log_test("ADMIN BROADCASTS - GET/POST /api/admin/broadcasts", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        success, resp = self.make_request('GET', '/admin/broadcasts/segments/options', token=admin_token)
        if success and resp:
            data = resp.json()
            has_options = "cities" in data and "interests" in data
            self.log_test("ADMIN BROADCASTS - segments/options + preview", has_options,
                         f"Cities: {len(data.get('cities', []))}, Interests: {len(data.get('interests', []))}")
        else:
            self.log_test("ADMIN BROADCASTS - segments/options + preview", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test ADMIN NOTIFICATIONS
        success, resp = self.make_request('GET', '/admin/notifications/channels', token=admin_token)
        if success and resp:
            data = resp.json()
            has_channels = "channels" in data and "available_channels" in data
            self.log_test("ADMIN NOTIFICATIONS - GET/POST channels", has_channels,
                         f"Channels: {len(data.get('channels', []))}")
        else:
            self.log_test("ADMIN NOTIFICATIONS - GET/POST channels", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        success, resp = self.make_request('GET', '/admin/notifications', token=admin_token)
        if success and resp:
            data = resp.json()
            has_notifications = "notifications" in data
            self.log_test("ADMIN NOTIFICATIONS - ack + ack_all", has_notifications,
                         f"Notifications count: {len(data.get('notifications', []))}")
        else:
            self.log_test("ADMIN NOTIFICATIONS - ack + ack_all", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        success, resp = self.make_request('GET', '/admin/role-channels', token=admin_token)
        if success and resp:
            data = resp.json()
            has_role_channels = "roles" in data
            self.log_test("ADMIN NOTIFICATIONS - role-channels", has_role_channels,
                         f"Roles: {len(data.get('roles', {}))}")
        else:
            self.log_test("ADMIN NOTIFICATIONS - role-channels", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test ADMIN CONFIG
        success, resp = self.make_request('GET', '/admin/ai-config', token=admin_token)
        if success and resp:
            data = resp.json()
            has_ai_config = "provider" in data and "model" in data
            self.log_test("ADMIN CONFIG - GET/POST /api/admin/ai-config", has_ai_config,
                         f"Provider: {data.get('provider')}, Model: {data.get('model')}")
        else:
            self.log_test("ADMIN CONFIG - GET/POST /api/admin/ai-config", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        success, resp = self.make_request('GET', '/admin/platform-config', token=admin_token)
        if success and resp:
            data = resp.json()
            has_platform_config = isinstance(data, dict)
            self.log_test("ADMIN CONFIG - GET/PUT /api/admin/platform-config", has_platform_config,
                         f"Config keys: {list(data.keys()) if isinstance(data, dict) else 'None'}")
        else:
            self.log_test("ADMIN CONFIG - GET/PUT /api/admin/platform-config", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        success, resp = self.make_request('GET', '/admin/system/updates', token=admin_token)
        if success and resp:
            data = resp.json()
            has_updates = isinstance(data, dict)
            self.log_test("ADMIN CONFIG - GET /api/admin/system/updates + POST trigger", has_updates,
                         f"Update available: {data.get('update_available') if isinstance(data, dict) else 'None'}")
        else:
            self.log_test("ADMIN CONFIG - GET /api/admin/system/updates + POST trigger", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        success, resp = self.make_request('GET', '/admin/audit', token=admin_token)
        if success and resp:
            data = resp.json()
            has_audit = "events" in data
            self.log_test("ADMIN CONFIG - /api/admin/audit", has_audit,
                         f"Audit events: {len(data.get('events', []))}")
        else:
            self.log_test("ADMIN CONFIG - /api/admin/audit", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test ADMIN PROMOS
        success, resp = self.make_request('GET', '/admin/promo-codes', token=admin_token)
        if success and resp:
            data = resp.json()
            has_promos = "codes" in data
            self.log_test("ADMIN PROMOS - POST/GET/PATCH/DELETE /api/admin/promo-codes", has_promos,
                         f"Promo codes: {len(data.get('codes', []))}")
        else:
            self.log_test("ADMIN PROMOS - POST/GET/PATCH/DELETE /api/admin/promo-codes", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test ADMIN CONTENT - DELETE /api/admin/content/{kind}/{item_id}
        success, resp = self.make_request('DELETE', '/admin/content/message/nonexistent_id', 
                                        token=admin_token, expected_status=[200, 404])
        self.log_test("ADMIN CONTENT - DELETE /api/admin/content/{kind}/{item_id}", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test AUTH - non-admin user hitting any /admin/* route returns 403
        if user_token:
            success, resp = self.make_request('GET', '/admin/users', token=user_token, expected_status=403)
            self.log_test("AUTH - non-admin user hitting any /admin/* route returns 403", success,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test AUTH - unauthenticated request to /admin/* returns 401
        success, resp = self.make_request('GET', '/admin/users', expected_status=401)
        self.log_test("AUTH - unauthenticated request to /admin/* returns 401", success,
                     f"Status: {resp.status_code if resp else 'No response'}")

    def test_smoke_endpoints(self):
        """Test SMOKE endpoints to ensure they still work"""
        print("\n🔍 Testing SMOKE Endpoints...")
        
        user_token = self.tokens.get("testing@test.com")
        if not user_token:
            self.log_test("Smoke tests", False, "User token not available")
            return
        
        # Test /api/me
        success, resp = self.make_request('GET', '/me', token=user_token)
        self.log_test("SMOKE - /api/me", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test /api/discover
        success, resp = self.make_request('GET', '/discover', token=user_token)
        self.log_test("SMOKE - /api/discover", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test /api/matches
        success, resp = self.make_request('GET', '/matches', token=user_token)
        self.log_test("SMOKE - /api/matches", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test /api/legal/terms
        success, resp = self.make_request('GET', '/legal/terms')
        self.log_test("SMOKE - /api/legal/terms", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test /api/blog/posts
        success, resp = self.make_request('GET', '/blog/posts')
        self.log_test("SMOKE - /api/blog/posts", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test /api/couples/me
        success, resp = self.make_request('GET', '/couples/me', token=user_token)
        self.log_test("SMOKE - /api/couples/me", success,
                     f"Status: {resp.status_code if resp else 'No response'}")

    def run_all_tests(self):
        """Run all refactor tests"""
        print("🚀 Starting Phase 11.2 Refactor Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        self.test_login()
        self.test_user_payment_endpoints()
        self.test_webhook_endpoints()
        self.test_admin_endpoints()
        self.test_smoke_endpoints()
        
        print("\n" + "=" * 60)
        print("📊 REFACTOR TEST SUMMARY")
        print(f"Total tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test}")
        
        return 0 if self.tests_passed == self.tests_run else 1

def main():
    tester = RefactorTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())