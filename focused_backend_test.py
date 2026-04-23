#!/usr/bin/env python3
"""
Focused backend testing for the specific review request:
- Legal pages (6 pages with substantial German content)
- Payment endpoints (PayPal, Klarna including new place-order)
- Existing endpoints still working
"""

import requests
import json
import sys
from datetime import datetime

class FocusedTester:
    def __init__(self, base_url="https://auto-implement-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

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

    def setup_auth(self):
        """Setup authentication tokens"""
        print("🔐 Setting up authentication...")
        
        # Admin login
        try:
            resp = requests.post(f"{self.base_url}/api/auth/login", 
                               json={"email": "admin@eros.app", "password": "admin123"},
                               timeout=10)
            if resp.status_code == 200:
                self.admin_token = resp.json()["access_token"]
                print("✅ Admin authentication successful")
            else:
                print(f"❌ Admin login failed: {resp.status_code}")
        except Exception as e:
            print(f"❌ Admin login error: {e}")

        # User login  
        try:
            resp = requests.post(f"{self.base_url}/api/auth/login",
                               json={"email": "testing@test.com", "password": "testpass123"},
                               timeout=10)
            if resp.status_code == 200:
                self.user_token = resp.json()["access_token"]
                print("✅ User authentication successful")
            else:
                print(f"❌ User login failed: {resp.status_code}")
        except Exception as e:
            print(f"❌ User login error: {e}")

    def test_legal_pages(self):
        """Test legal pages as specified in review request"""
        print("\n🔍 Testing Legal Pages...")
        
        # Test GET /api/legal (public endpoint)
        try:
            resp = requests.get(f"{self.base_url}/api/legal", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                pages = data.get("pages", [])
                expected_keys = {"terms", "privacy", "imprint", "community", "cookies", "cancellation"}
                found_keys = {page.get("key") for page in pages}
                
                has_all_pages = expected_keys.issubset(found_keys)
                self.log_test("GET /api/legal - All 6 pages present", has_all_pages,
                             f"Found: {found_keys}")
            else:
                self.log_test("GET /api/legal", False, f"Status: {resp.status_code}")
        except Exception as e:
            self.log_test("GET /api/legal", False, f"Error: {e}")

        # Test individual legal pages
        legal_keys = ["terms", "privacy", "imprint", "community", "cookies", "cancellation"]
        for key in legal_keys:
            try:
                resp = requests.get(f"{self.base_url}/api/legal/{key}", timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("content_markdown", "")
                    content_length = len(content)
                    
                    if key == "terms":
                        # Check for >4000 characters and German quotes
                        # Check for German quotes using Unicode characters
                        has_german_quotes = "\u201eAGB\u201c" in content
                        is_substantial = content_length > 4000
                        self.log_test(f"GET /api/legal/{key} - Substantial German content", 
                                     is_substantial and has_german_quotes,
                                     f"Length: {content_length}, German quotes: {has_german_quotes}")
                    elif key == "imprint":
                        # Check for >500 characters
                        is_substantial = content_length > 500
                        self.log_test(f"GET /api/legal/{key} - Substantial content", 
                                     is_substantial, f"Length: {content_length}")
                    else:
                        # Check for non-trivial content
                        is_non_trivial = content_length > 50
                        self.log_test(f"GET /api/legal/{key} - Non-trivial content", 
                                     is_non_trivial, f"Length: {content_length}")
                else:
                    self.log_test(f"GET /api/legal/{key}", False, f"Status: {resp.status_code}")
            except Exception as e:
                self.log_test(f"GET /api/legal/{key}", False, f"Error: {e}")

    def test_payment_endpoints(self):
        """Test payment endpoints as specified in review request"""
        print("\n🔍 Testing Payment Endpoints...")
        
        if not self.user_token:
            self.log_test("Payment endpoints", False, "No user token available")
            return

        headers = {"Authorization": f"Bearer {self.user_token}", "Content-Type": "application/json"}

        # Test GET /api/payments/packages
        try:
            resp = requests.get(f"{self.base_url}/api/payments/packages", headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                required_fields = ["enabled", "provider", "supported", "packages", "providers_live"]
                has_required_fields = all(field in data for field in required_fields)
                
                providers_live = data.get("providers_live", {})
                has_provider_status = all(provider in providers_live for provider in ["stripe", "paypal", "klarna"])
                
                self.log_test("GET /api/payments/packages - Required fields", has_required_fields,
                             f"Fields: {list(data.keys())}")
                self.log_test("GET /api/payments/packages - Provider status", has_provider_status,
                             f"Providers: {list(providers_live.keys())}")
            else:
                self.log_test("GET /api/payments/packages", False, f"Status: {resp.status_code}")
        except Exception as e:
            self.log_test("GET /api/payments/packages", False, f"Error: {e}")

        # Test POST /api/payments/paypal/create-order
        try:
            paypal_data = {"package_id": "premium_30", "origin_url": "https://example.com/premium"}
            resp = requests.post(f"{self.base_url}/api/payments/paypal/create-order", 
                               json=paypal_data, headers=headers, timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                has_order_fields = "order_id" in data and "approve_url" in data
                self.log_test("POST /api/payments/paypal/create-order - Success", has_order_fields,
                             f"Order ID: {data.get('order_id', 'None')}")
            elif resp.status_code == 502:
                # Expected when PayPal credentials are missing
                error_data = resp.json()
                error_msg = error_data.get("detail", "")
                is_german_error = "PayPal" in error_msg and ("fehlgeschlagen" in error_msg or "nicht" in error_msg)
                self.log_test("POST /api/payments/paypal/create-order - Expected 502", is_german_error,
                             f"German error: {error_msg}")
            else:
                self.log_test("POST /api/payments/paypal/create-order", False, f"Status: {resp.status_code}")
        except Exception as e:
            self.log_test("POST /api/payments/paypal/create-order", False, f"Error: {e}")

        # Test POST /api/payments/klarna/create-session
        try:
            klarna_data = {"package_id": "premium_30", "country": "DE"}
            resp = requests.post(f"{self.base_url}/api/payments/klarna/create-session",
                               json=klarna_data, headers=headers, timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                has_session_fields = "session_id" in data
                self.log_test("POST /api/payments/klarna/create-session - Success", has_session_fields,
                             f"Session ID: {data.get('session_id', 'None')}")
            elif resp.status_code == 400:
                # Expected when Klarna is not configured
                error_data = resp.json()
                error_msg = error_data.get("detail", "")
                is_german_error = "Klarna" in error_msg and ("konfiguriert" in error_msg or "fehlen" in error_msg)
                self.log_test("POST /api/payments/klarna/create-session - Expected 400", is_german_error,
                             f"German error: {error_msg}")
            else:
                self.log_test("POST /api/payments/klarna/create-session", False, f"Status: {resp.status_code}")
        except Exception as e:
            self.log_test("POST /api/payments/klarna/create-session", False, f"Error: {e}")

        # Test POST /api/payments/klarna/place-order (NEW endpoint)
        try:
            klarna_place_data = {
                "package_id": "premium_30", 
                "authorization_token": "test_auth_token_123",
                "country": "DE"
            }
            resp = requests.post(f"{self.base_url}/api/payments/klarna/place-order",
                               json=klarna_place_data, headers=headers, timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                has_order_fields = "order_id" in data and "paid" in data
                self.log_test("POST /api/payments/klarna/place-order - Success", has_order_fields,
                             f"Order ID: {data.get('order_id', 'None')}, Paid: {data.get('paid')}")
            elif resp.status_code == 400:
                # Expected when Klarna is not configured
                error_data = resp.json()
                error_msg = error_data.get("detail", "")
                is_german_error = "Klarna" in error_msg and ("konfiguriert" in error_msg or "fehlen" in error_msg)
                self.log_test("POST /api/payments/klarna/place-order - Expected 400", is_german_error,
                             f"German error: {error_msg}")
            else:
                self.log_test("POST /api/payments/klarna/place-order", False, f"Status: {resp.status_code}")
        except Exception as e:
            self.log_test("POST /api/payments/klarna/place-order", False, f"Error: {e}")

    def test_existing_endpoints(self):
        """Test that existing endpoints still work"""
        print("\n🔍 Testing Existing Endpoints Still Work...")
        
        if not self.user_token:
            self.log_test("Existing endpoints", False, "No user token available")
            return

        headers = {"Authorization": f"Bearer {self.user_token}"}
        
        # Test core endpoints that should still work
        endpoints_to_test = [
            '/me', '/discover', '/matches', '/albums', '/events', 
            '/blog/posts', '/me/visitors', '/me/broadcasts'
        ]
        
        for endpoint in endpoints_to_test:
            try:
                resp = requests.get(f"{self.base_url}/api{endpoint}", headers=headers, timeout=10)
                success = resp.status_code == 200
                self.log_test(f"GET /api{endpoint} - Still works", success, 
                             f"Status: {resp.status_code}")
            except Exception as e:
                self.log_test(f"GET /api{endpoint} - Still works", False, f"Error: {e}")

    def run_focused_tests(self):
        """Run the focused tests for the review request"""
        print("🚀 Starting Focused Backend Tests for Review Request")
        print("=" * 60)
        
        self.setup_auth()
        
        if not self.admin_token and not self.user_token:
            print("❌ No authentication tokens available, cannot proceed")
            return False
        
        try:
            self.test_legal_pages()
            self.test_payment_endpoints() 
            self.test_existing_endpoints()
        except Exception as e:
            print(f"\n❌ Test suite error: {str(e)}")
            self.failed_tests.append(f"Test suite error: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 FOCUSED TEST SUMMARY")
        print(f"Total tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  - {failure}")
        
        return len(self.failed_tests) == 0

def main():
    """Main test runner"""
    tester = FocusedTester()
    success = tester.run_focused_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())