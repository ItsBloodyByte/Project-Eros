#!/usr/bin/env python3
"""
Phase 5 Extension Backend Testing for German Inclusive Modern Dating Platform.
Tests the specific Phase 5 extension features:
1. Payment configuration with multiple providers (only stripe functional)
2. Chat message link blocking functionality
3. CMS-light legal pages system
"""

import requests
import json
import sys
from datetime import datetime, timezone
from typing import Dict, Optional, List

class Phase5ExtensionTester:
    def __init__(self, base_url="https://auto-implement-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.tokens = {}  # user_email -> token
        self.users = {}   # user_email -> user_data
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Test credentials from the requirements
        self.test_users = {
            "admin@eros.app": {"password": "Passw0rd!2025", "role": "admin"},
            "alice@eros.app": {"password": "Passw0rd!2025", "role": "user"}
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

    def make_request(self, method: str, endpoint: str, data=None, token=None, expected_status=200):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code == expected_status
            return success, response
        except requests.exceptions.Timeout:
            print(f"Request timeout for {method} {endpoint}")
            return False, None
        except requests.exceptions.ConnectionError as e:
            print(f"Connection error for {method} {endpoint}: {str(e)}")
            return False, None
        except Exception as e:
            print(f"Request error for {method} {endpoint}: {str(e)}")
            return False, None

    def login_users(self):
        """Login test users"""
        print("\n🔍 Logging in test users...")
        
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

    def get_alice_match_id(self):
        """Get Alice's match ID for chat testing"""
        alice_token = self.tokens.get("alice@eros.app")
        if not alice_token:
            return None
        
        success, resp = self.make_request('GET', '/matches', token=alice_token)
        if success and resp:
            data = resp.json()
            matches = data.get("matches", [])
            if matches:
                return matches[0]["id"]
        return None

    # =====================================================================
    # Payment Configuration Tests
    # =====================================================================

    def test_payment_packages_endpoint(self):
        """Test GET /api/payments/packages returns enabled, provider, supported, packages"""
        print("\n🔍 Testing Payment Packages Endpoint...")
        
        alice_token = self.tokens.get("alice@eros.app")
        if not alice_token:
            self.log_test("Payment packages test", False, "Alice token not available")
            return
        
        success, resp = self.make_request('GET', '/payments/packages', token=alice_token)
        if success and resp:
            data = resp.json()
            required_fields = ["enabled", "provider", "supported", "packages"]
            has_all_fields = all(field in data for field in required_fields)
            
            # Check that supported is boolean and true only when provider=='stripe'
            supported = data.get("supported")
            provider = data.get("provider")
            supported_correct = isinstance(supported, bool) and (supported == (provider == "stripe"))
            
            self.log_test("GET /api/payments/packages - Required fields", has_all_fields,
                         f"Fields: {list(data.keys())}")
            self.log_test("GET /api/payments/packages - Supported logic", supported_correct,
                         f"Provider: {provider}, Supported: {supported}")
        else:
            self.log_test("GET /api/payments/packages", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")

    def test_admin_payment_config_get(self):
        """Test GET /api/admin/payment-config returns expected fields"""
        print("\n🔍 Testing Admin Payment Config GET...")
        
        admin_token = self.tokens.get("admin@eros.app")
        alice_token = self.tokens.get("alice@eros.app")
        
        if not admin_token:
            self.log_test("Admin payment config GET", False, "Admin token not available")
            return
        
        # Test admin access
        success, resp = self.make_request('GET', '/admin/payment-config', token=admin_token)
        if success and resp:
            data = resp.json()
            required_fields = ["provider_keys_masked", "stripe_api_key_masked", "supported_providers", "known_providers"]
            has_all_fields = all(field in data for field in required_fields)
            
            # Check supported_providers contains stripe
            supported_providers = data.get("supported_providers", [])
            has_stripe = "stripe" in supported_providers
            
            # Check known_providers includes expected providers
            known_providers = data.get("known_providers", [])
            expected_providers = ["paypal", "mollie", "klarna", "paddle", "custom"]
            has_expected = all(provider in known_providers for provider in expected_providers)
            
            self.log_test("GET /api/admin/payment-config - Admin access", has_all_fields,
                         f"Fields: {list(data.keys())}")
            self.log_test("GET /api/admin/payment-config - Supported providers", has_stripe,
                         f"Supported: {supported_providers}")
            self.log_test("GET /api/admin/payment-config - Known providers", has_expected,
                         f"Known: {known_providers}")
        else:
            self.log_test("GET /api/admin/payment-config - Admin access", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test non-admin access (should return 403)
        if alice_token:
            success, resp = self.make_request('GET', '/admin/payment-config', token=alice_token, expected_status=403)
            self.log_test("GET /api/admin/payment-config - Non-admin blocked", success,
                         "Regular user correctly blocked from payment config")

    def test_admin_payment_config_post_paypal(self):
        """Test POST /api/admin/payment-config with paypal provider"""
        print("\n🔍 Testing Admin Payment Config POST - PayPal...")
        
        admin_token = self.tokens.get("admin@eros.app")
        if not admin_token:
            self.log_test("Admin payment config POST PayPal", False, "Admin token not available")
            return
        
        # Set PayPal configuration
        paypal_config = {
            "provider": "paypal",
            "enabled": True,
            "provider_keys": {
                "paypal": {
                    "client_id": "ci_x",
                    "secret": "sec_x"
                }
            }
        }
        
        success, resp = self.make_request('POST', '/admin/payment-config', paypal_config, token=admin_token)
        if success:
            self.log_test("POST /api/admin/payment-config - PayPal config", True, "PayPal config accepted")
            
            # Verify the configuration was saved with masked values
            success2, resp2 = self.make_request('GET', '/admin/payment-config', token=admin_token)
            if success2 and resp2:
                data = resp2.json()
                provider_keys_masked = data.get("provider_keys_masked", {})
                paypal_keys = provider_keys_masked.get("paypal", {})
                
                # Check if values are masked (should contain original value but masked)
                client_id_masked = paypal_keys.get("client_id", "")
                secret_masked = paypal_keys.get("secret", "")
                
                has_masked_values = ("ci_x" in client_id_masked or "***" in client_id_masked) and \
                                  ("sec_x" in secret_masked or "***" in secret_masked)
                
                self.log_test("POST /api/admin/payment-config - PayPal masked values", has_masked_values,
                             f"Client ID: {client_id_masked}, Secret: {secret_masked}")
            else:
                self.log_test("POST /api/admin/payment-config - PayPal verification", False, 
                             "Failed to verify PayPal config")
        else:
            self.log_test("POST /api/admin/payment-config - PayPal config", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")

    def test_admin_payment_config_post_stripe(self):
        """Test POST /api/admin/payment-config with stripe provider"""
        print("\n🔍 Testing Admin Payment Config POST - Stripe...")
        
        admin_token = self.tokens.get("admin@eros.app")
        if not admin_token:
            self.log_test("Admin payment config POST Stripe", False, "Admin token not available")
            return
        
        # Set Stripe configuration
        stripe_config = {
            "provider": "stripe",
            "enabled": True,
            "stripe_api_key": "sk_test_emergent"
        }
        
        success, resp = self.make_request('POST', '/admin/payment-config', stripe_config, token=admin_token)
        self.log_test("POST /api/admin/payment-config - Stripe config", success, 
                     "Stripe config with sk_test_emergent")

    def test_payment_checkout_stripe(self):
        """Test POST /api/payments/checkout with stripe provider"""
        print("\n🔍 Testing Payment Checkout - Stripe...")
        
        admin_token = self.tokens.get("admin@eros.app")
        alice_token = self.tokens.get("alice@eros.app")
        
        if not admin_token or not alice_token:
            self.log_test("Payment checkout Stripe", False, "Required tokens not available")
            return
        
        # First ensure Stripe is configured
        stripe_config = {
            "provider": "stripe",
            "enabled": True,
            "stripe_api_key": "sk_test_emergent"
        }
        self.make_request('POST', '/admin/payment-config', stripe_config, token=admin_token)
        
        # Test checkout with Stripe
        checkout_data = {
            "package_id": "premium_30",
            "origin_url": "http://x"
        }
        
        success, resp = self.make_request('POST', '/payments/checkout', checkout_data, token=alice_token)
        if success and resp:
            data = resp.json()
            required_fields = ["url", "session_id", "provider"]
            has_all_fields = all(field in data for field in required_fields)
            provider_correct = data.get("provider") == "stripe"
            
            self.log_test("POST /api/payments/checkout - Stripe success", has_all_fields and provider_correct,
                         f"Fields: {list(data.keys())}, Provider: {data.get('provider')}")
        else:
            self.log_test("POST /api/payments/checkout - Stripe success", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")

    def test_payment_checkout_paypal_501(self):
        """Test POST /api/payments/checkout with paypal returns 501"""
        print("\n🔍 Testing Payment Checkout - PayPal 501...")
        
        admin_token = self.tokens.get("admin@eros.app")
        alice_token = self.tokens.get("alice@eros.app")
        
        if not admin_token or not alice_token:
            self.log_test("Payment checkout PayPal 501", False, "Required tokens not available")
            return
        
        # Switch to PayPal provider
        paypal_config = {
            "provider": "paypal",
            "enabled": True,
            "provider_keys": {
                "paypal": {
                    "client_id": "ci_x",
                    "secret": "sec_x"
                }
            }
        }
        config_success, _ = self.make_request('POST', '/admin/payment-config', paypal_config, token=admin_token)
        if not config_success:
            self.log_test("Payment checkout PayPal 501", False, "Failed to set PayPal config")
            return
        
        # Small delay to ensure config is applied
        import time
        time.sleep(0.5)
        
        # Test checkout with PayPal (should return 501)
        checkout_data = {
            "package_id": "premium_30",
            "origin_url": "http://x"
        }
        
        success, resp = self.make_request('POST', '/payments/checkout', checkout_data, 
                                        token=alice_token, expected_status=501)
        if success and resp:
            try:
                data = resp.json()
                message = data.get("detail", "").lower()
                has_paypal_message = "paypal" in message and "noch nicht integriert" in message
                self.log_test("POST /api/payments/checkout - PayPal 501", has_paypal_message,
                             f"Message: {data.get('detail', '')}")
            except Exception as e:
                self.log_test("POST /api/payments/checkout - PayPal 501", True, 
                             f"501 status returned (JSON parse error: {e})")
        else:
            # Debug: Try to get more information
            print(f"Debug: success={success}, resp={resp}")
            if resp:
                print(f"Debug: status_code={resp.status_code}, text={resp.text}")
                # If we got a response but success is False, check if it's actually 501
                if resp.status_code == 501:
                    try:
                        data = resp.json()
                        message = data.get("detail", "").lower()
                        has_paypal_message = "paypal" in message and "noch nicht integriert" in message
                        self.log_test("POST /api/payments/checkout - PayPal 501", has_paypal_message,
                                     f"Message: {data.get('detail', '')}")
                        return
                    except:
                        self.log_test("POST /api/payments/checkout - PayPal 501", True, "501 status returned")
                        return
            
            self.log_test("POST /api/payments/checkout - PayPal 501", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")

    def test_admin_payment_config_non_admin_403(self):
        """Test non-admin POST /api/admin/payment-config returns 403"""
        print("\n🔍 Testing Admin Payment Config - Non-admin 403...")
        
        alice_token = self.tokens.get("alice@eros.app")
        if not alice_token:
            self.log_test("Admin payment config non-admin 403", False, "Alice token not available")
            return
        
        config_data = {
            "provider": "stripe",
            "enabled": True,
            "stripe_api_key": "sk_test_fake"
        }
        
        success, resp = self.make_request('POST', '/admin/payment-config', config_data, 
                                        token=alice_token, expected_status=403)
        self.log_test("POST /api/admin/payment-config - Non-admin 403", success,
                     "Regular user correctly blocked from payment config")

    # =====================================================================
    # Chat Link Blocking Tests
    # =====================================================================

    def test_chat_link_blocking(self):
        """Test chat message link blocking functionality"""
        print("\n🔍 Testing Chat Link Blocking...")
        
        alice_token = self.tokens.get("alice@eros.app")
        if not alice_token:
            self.log_test("Chat link blocking", False, "Alice token not available")
            return
        
        # Get Alice's match ID
        match_id = self.get_alice_match_id()
        if not match_id:
            self.log_test("Chat link blocking", False, "No match ID available for Alice")
            return
        
        # Test cases that should be blocked (return 400)
        blocked_messages = [
            "google.com",
            "schau google.com an",
            "hey google com",
            "check google .com",
            "g o o g l e . c o m",
            "hans@ex.de",
            "bitly .com"
        ]
        
        for text in blocked_messages:
            message_data = {
                "match_id": match_id,
                "text": text
            }
            success, resp = self.make_request('POST', '/messages', message_data, 
                                            token=alice_token, expected_status=400)
            self.log_test(f"Chat link blocking - '{text}'", success,
                         f"Correctly blocked: {text}")
        
        # Test cases that should be allowed (return 200)
        allowed_messages = [
            "Hallo wie geht es dir heute",
            "treffen wir uns in Berlin",
            "ich mag dich",
            "das schaffe ich bis morgen"
        ]
        
        for text in allowed_messages:
            message_data = {
                "match_id": match_id,
                "text": text
            }
            success, resp = self.make_request('POST', '/messages', message_data, token=alice_token)
            self.log_test(f"Chat link allowing - '{text}'", success,
                         f"Correctly allowed: {text}")

    # =====================================================================
    # Legal Pages Tests
    # =====================================================================

    def test_legal_pages_public_get(self):
        """Test public GET /api/legal returns list of 6 pages"""
        print("\n🔍 Testing Legal Pages - Public GET...")
        
        # Test without authentication (should work)
        success, resp = self.make_request('GET', '/legal')
        if success and resp:
            data = resp.json()
            # Handle both direct list and {"pages": [...]} format
            pages = data if isinstance(data, list) else data.get("pages", [])
            
            if isinstance(pages, list):
                expected_keys = {"terms", "privacy", "imprint", "community", "cookies", "cancellation"}
                found_keys = set()
                for page in pages:
                    if isinstance(page, dict) and "key" in page:
                        found_keys.add(page["key"])
                
                has_all_keys = expected_keys.issubset(found_keys)
                self.log_test("GET /api/legal - 6 pages", len(pages) >= 6 and has_all_keys,
                             f"Pages: {len(pages)}, Keys: {sorted(found_keys)}")
            else:
                self.log_test("GET /api/legal - 6 pages", False, f"Pages not a list: {type(pages)}")
        else:
            self.log_test("GET /api/legal - 6 pages", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")

    def test_legal_page_public_get_specific(self):
        """Test public GET /api/legal/imprint returns page details"""
        print("\n🔍 Testing Legal Pages - Public GET Specific...")
        
        success, resp = self.make_request('GET', '/legal/imprint')
        if success and resp:
            data = resp.json()
            required_fields = ["key", "title", "content_markdown", "updated_at"]
            has_all_fields = all(field in data for field in required_fields)
            key_correct = data.get("key") == "imprint"
            
            self.log_test("GET /api/legal/imprint", has_all_fields and key_correct,
                         f"Fields: {list(data.keys())}, Key: {data.get('key')}")
        else:
            self.log_test("GET /api/legal/imprint", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")

    def test_legal_page_admin_put(self):
        """Test admin PUT /api/admin/legal/{key} updates page"""
        print("\n🔍 Testing Legal Pages - Admin PUT...")
        
        admin_token = self.tokens.get("admin@eros.app")
        alice_token = self.tokens.get("alice@eros.app")
        
        if not admin_token:
            self.log_test("Legal pages admin PUT", False, "Admin token not available")
            return
        
        # Test admin can update legal page
        update_data = {
            "title": "Impressum v2",
            "content_markdown": "# Test"
        }
        
        success, resp = self.make_request('PUT', '/admin/legal/imprint', update_data, token=admin_token)
        if success:
            self.log_test("PUT /api/admin/legal/imprint - Admin success", True, "Admin can update legal page")
            
            # Verify the update was applied
            success2, resp2 = self.make_request('GET', '/legal/imprint')
            if success2 and resp2:
                data = resp2.json()
                title_updated = data.get("title") == "Impressum v2"
                content_updated = data.get("content_markdown") == "# Test"
                
                self.log_test("PUT /api/admin/legal/imprint - Update verification", 
                             title_updated and content_updated,
                             f"Title: {data.get('title')}, Content: {data.get('content_markdown')}")
            else:
                self.log_test("PUT /api/admin/legal/imprint - Update verification", False,
                             "Failed to verify update")
        else:
            self.log_test("PUT /api/admin/legal/imprint - Admin success", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test non-admin cannot update legal page (should return 403)
        if alice_token:
            success, resp = self.make_request('PUT', '/admin/legal/imprint', update_data, 
                                            token=alice_token, expected_status=403)
            self.log_test("PUT /api/admin/legal/imprint - Non-admin 403", success,
                         "Regular user correctly blocked from legal page updates")

    def test_legal_page_admin_put_unknown_key(self):
        """Test admin PUT /api/admin/legal/unknown_key returns 404"""
        print("\n🔍 Testing Legal Pages - Admin PUT Unknown Key...")
        
        admin_token = self.tokens.get("admin@eros.app")
        if not admin_token:
            self.log_test("Legal pages admin PUT unknown key", False, "Admin token not available")
            return
        
        update_data = {
            "title": "Unknown Page",
            "content_markdown": "# This should fail"
        }
        
        success, resp = self.make_request('PUT', '/admin/legal/unknown_key', update_data, 
                                        token=admin_token, expected_status=404)
        self.log_test("PUT /api/admin/legal/unknown_key - 404", success,
                     "Unknown key correctly returns 404")

    # =====================================================================
    # Main Test Runner
    # =====================================================================

    def run_all_tests(self):
        """Run all Phase 5 extension tests"""
        print("🚀 Starting Phase 5 Extension Backend Tests...")
        print(f"Base URL: {self.base_url}")
        
        # Login users first
        self.login_users()
        
        # Payment Configuration Tests
        self.test_payment_packages_endpoint()
        self.test_admin_payment_config_get()
        self.test_admin_payment_config_post_paypal()
        self.test_admin_payment_config_post_stripe()
        self.test_payment_checkout_stripe()
        self.test_payment_checkout_paypal_501()
        self.test_admin_payment_config_non_admin_403()
        
        # Chat Link Blocking Tests
        self.test_chat_link_blocking()
        
        # Legal Pages Tests
        self.test_legal_pages_public_get()
        self.test_legal_page_public_get_specific()
        self.test_legal_page_admin_put()
        self.test_legal_page_admin_put_unknown_key()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed tests:")
            for failure in self.failed_tests:
                print(f"  - {failure}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = Phase5ExtensionTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())