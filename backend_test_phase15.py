#!/usr/bin/env python3
"""
Phase 15.1 Backend Testing - Sparks System & Monetization
Tests the new Sparks reward currency, subscription model, and tier-based limits.
"""

import requests
import json
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional

class Phase15Tester:
    def __init__(self, base_url="https://auto-implement-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.tokens = {}
        self.users = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Test credentials
        self.admin_creds = {"email": "admin@eros.app", "password": "admin123"}
        self.test_user_creds = {"email": "testing@test.com", "password": "testpass123"}

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
        """Make HTTP request"""
        url = f"{self.base_url}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        expected_statuses = expected_status if isinstance(expected_status, list) else [expected_status]
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code in expected_statuses
            
            # Log error details for debugging
            if not success and response.status_code >= 400:
                try:
                    error_detail = response.json()
                    print(f"    ⚠️  HTTP {response.status_code}: {error_detail}")
                except:
                    print(f"    ⚠️  HTTP {response.status_code}: {response.text[:200]}")
            
            return success, response
        except Exception as e:
            print(f"    ⚠️  Request error: {str(e)}")
            return False, None

    def login(self, email: str, password: str) -> Optional[str]:
        """Login and return token"""
        success, resp = self.make_request('POST', '/auth/login', 
                                         {"email": email, "password": password})
        if success and resp:
            data = resp.json()
            token = data.get("access_token")
            if token:
                self.tokens[email] = token
                self.users[email] = data.get("user", {})
                return token
        return None

    def test_sparks_balance_endpoint(self):
        """Test GET /api/me/sparks - returns balance + rates + packages"""
        print("\n🔍 Testing Sparks Balance Endpoint...")
        
        token = self.login(self.test_user_creds["email"], self.test_user_creds["password"])
        if not token:
            self.log_test("Login for sparks test", False, "Failed to login")
            return
        
        success, resp = self.make_request('GET', '/me/sparks', token=token)
        if not success or not resp:
            self.log_test("GET /api/me/sparks", False, "Request failed")
            return
        
        data = resp.json()
        
        # Check required fields
        has_balance = "balance" in data and isinstance(data["balance"], int)
        has_rates_earn = "rates_earn" in data and isinstance(data["rates_earn"], dict)
        has_rates_spend = "rates_spend" in data and isinstance(data["rates_spend"], dict)
        has_packages = "packages" in data and isinstance(data["packages"], list)
        
        # Validate rates_earn structure
        rates_earn_valid = False
        if has_rates_earn:
            expected_keys = ["daily_login", "profile_complete", "verify_email", "first_match"]
            rates_earn_valid = all(k in data["rates_earn"] for k in expected_keys)
            if rates_earn_valid:
                # Check specific values from monetization.py
                rates_earn_valid = (
                    data["rates_earn"]["daily_login"] == 2 and
                    data["rates_earn"]["profile_complete"] == 20 and
                    data["rates_earn"]["verify_email"] == 10 and
                    data["rates_earn"]["first_match"] == 10
                )
        
        # Validate rates_spend structure
        rates_spend_valid = False
        if has_rates_spend:
            expected_keys = ["boost_1h", "very_interested_signal"]
            rates_spend_valid = all(k in data["rates_spend"] for k in expected_keys)
        
        # Validate packages structure
        packages_valid = False
        if has_packages and len(data["packages"]) > 0:
            pkg = data["packages"][0]
            packages_valid = all(k in pkg for k in ["id", "sparks", "bonus", "price_eur_cents"])
        
        all_valid = has_balance and has_rates_earn and has_rates_spend and has_packages and rates_earn_valid and rates_spend_valid and packages_valid
        
        self.log_test(
            "GET /api/me/sparks structure",
            all_valid,
            f"balance={data.get('balance')}, rates_earn_keys={list(data.get('rates_earn', {}).keys())[:3]}, packages_count={len(data.get('packages', []))}"
        )

    def test_sparks_ledger_endpoint(self):
        """Test GET /api/me/sparks/ledger - paginated ledger newest-first"""
        print("\n🔍 Testing Sparks Ledger Endpoint...")
        
        token = self.tokens.get(self.test_user_creds["email"])
        if not token:
            token = self.login(self.test_user_creds["email"], self.test_user_creds["password"])
        
        if not token:
            self.log_test("Sparks ledger test", False, "No token available")
            return
        
        success, resp = self.make_request('GET', '/me/sparks/ledger?limit=50', token=token)
        if not success or not resp:
            self.log_test("GET /api/me/sparks/ledger", False, "Request failed")
            return
        
        data = resp.json()
        has_rows = "rows" in data and isinstance(data["rows"], list)
        has_cursor = "next_cursor" in data
        
        # Check if rows are sorted newest-first
        sorted_correctly = True
        if has_rows and len(data["rows"]) > 1:
            for i in range(len(data["rows"]) - 1):
                if data["rows"][i]["created_at"] < data["rows"][i+1]["created_at"]:
                    sorted_correctly = False
                    break
        
        # Validate row structure if any rows exist
        row_valid = True
        if has_rows and len(data["rows"]) > 0:
            row = data["rows"][0]
            required_fields = ["id", "user_id", "amount", "balance_after", "transaction_type", "created_at"]
            row_valid = all(k in row for k in required_fields)
        
        all_valid = has_rows and has_cursor and sorted_correctly and row_valid
        
        self.log_test(
            "GET /api/me/sparks/ledger",
            all_valid,
            f"rows_count={len(data.get('rows', []))}, sorted_newest_first={sorted_correctly}, has_cursor={has_cursor}"
        )

    def test_daily_login_idempotency(self):
        """Test POST /api/auth/login twice same day - should only credit +2 sparks once"""
        print("\n🔍 Testing Daily Login Idempotency...")
        
        # Get initial balance
        token = self.tokens.get(self.test_user_creds["email"])
        if not token:
            token = self.login(self.test_user_creds["email"], self.test_user_creds["password"])
        
        success, resp = self.make_request('GET', '/me/sparks', token=token)
        if not success or not resp:
            self.log_test("Daily login idempotency", False, "Failed to get initial balance")
            return
        
        initial_balance = resp.json().get("balance", 0)
        
        # Login again (same day)
        time.sleep(1)
        token2 = self.login(self.test_user_creds["email"], self.test_user_creds["password"])
        
        # Check balance again
        success, resp = self.make_request('GET', '/me/sparks', token=token2)
        if not success or not resp:
            self.log_test("Daily login idempotency", False, "Failed to get balance after 2nd login")
            return
        
        final_balance = resp.json().get("balance", 0)
        
        # Balance should be the same (no additional +2 sparks)
        idempotent = (final_balance == initial_balance)
        
        self.log_test(
            "Daily login idempotency",
            idempotent,
            f"initial={initial_balance}, after_2nd_login={final_balance}, diff={final_balance - initial_balance}"
        )

    def test_admin_sparks_adjust(self):
        """Test POST /api/admin/sparks/{user_id}/adjust"""
        print("\n🔍 Testing Admin Sparks Adjustment...")
        
        # Login as admin
        admin_token = self.login(self.admin_creds["email"], self.admin_creds["password"])
        if not admin_token:
            self.log_test("Admin login", False, "Failed to login as admin")
            return
        
        # Get test user ID
        test_user = self.users.get(self.test_user_creds["email"])
        if not test_user:
            self.log_test("Admin sparks adjust", False, "Test user not found")
            return
        
        user_id = test_user.get("id")
        
        # Test 1: Credit +50 sparks
        success, resp = self.make_request(
            'POST', 
            f'/admin/sparks/{user_id}/adjust',
            {"amount": 50, "note": "Test credit"},
            token=admin_token
        )
        
        credit_success = success and resp and resp.json().get("ok") == True
        self.log_test(
            "Admin credit +50 sparks",
            credit_success,
            f"Response: {resp.json() if resp else 'No response'}"
        )
        
        # Test 2: Try to debit more than balance (should fail with 400)
        success, resp = self.make_request(
            'POST',
            f'/admin/sparks/{user_id}/adjust',
            {"amount": -999999, "note": "Test overdraft"},
            token=admin_token,
            expected_status=400
        )
        
        overdraft_blocked = success and resp is not None
        error_msg = ""
        if resp:
            try:
                data = resp.json()
                error_msg = data.get("detail", "")
            except Exception as e:
                print(f"    ⚠️  Error parsing overdraft response: {e}")
        
        self.log_test(
            "Admin debit overdraft protection",
            overdraft_blocked,
            f"Status={resp.status_code if resp else 'N/A'}, blocked={overdraft_blocked}, Error='{error_msg[:80] if error_msg else 'N/A'}'"
        )
        
        # Test 3: Non-admin should get 403
        user_token = self.tokens.get(self.test_user_creds["email"])
        success, resp = self.make_request(
            'POST',
            f'/admin/sparks/{user_id}/adjust',
            {"amount": 10, "note": "Unauthorized attempt"},
            token=user_token,
            expected_status=403
        )
        
        self.log_test(
            "Non-admin sparks adjust blocked (403)",
            success,
            f"Status={resp.status_code if resp else 'N/A'}"
        )

    def test_album_limit_free_tier(self):
        """Test album limit (Free=2) - 3rd album should return 400"""
        print("\n🔍 Testing Album Limit (Free Tier)...")
        
        # Create a fresh test user to ensure clean state
        timestamp = int(time.time())
        new_user_email = f"albumtest{timestamp}@test.com"
        
        # Register new user
        success, resp = self.make_request(
            'POST',
            '/auth/register',
            {
                "email": new_user_email,
                "password": "TestPass123!",
                "display_name": "Album Tester",
                "birth_date": "1995-01-01",
                "gender_identity": "man",  # Fixed: use "man" instead of "male"
                "consents": {
                    "terms": True,
                    "privacy": True,
                    "sensitive_data": True,
                    "nsfw_view": True
                }
            }
        )
        
        if not success or not resp:
            self.log_test("Album limit test - user creation", False, "Failed to create test user")
            return
        
        token = resp.json().get("access_token")
        
        # Create 1st album
        success1, resp1 = self.make_request(
            'POST',
            '/albums',
            {"title": "Album 1", "description": "First album", "is_nsfw": False},
            token=token
        )
        
        # Create 2nd album
        success2, resp2 = self.make_request(
            'POST',
            '/albums',
            {"title": "Album 2", "description": "Second album", "is_nsfw": False},
            token=token
        )
        
        # Try to create 3rd album (should fail with 400)
        success3, resp3 = self.make_request(
            'POST',
            '/albums',
            {"title": "Album 3", "description": "Third album", "is_nsfw": False},
            token=token,
            expected_status=400
        )
        
        error_msg = ""
        has_german_msg = False
        if resp3:
            try:
                data = resp3.json()
                error_msg = data.get("detail", "")
                # Check for German error message mentioning Premium
                has_german_msg = "Premium" in error_msg and ("Album" in error_msg or "Limit" in error_msg)
            except Exception as e:
                print(f"    ⚠️  Error parsing response: {e}, status={resp3.status_code}")
        
        all_valid = success1 and success2 and success3 and has_german_msg
        
        self.log_test(
            "Album limit (Free=2)",
            all_valid,
            f"1st={success1}, 2nd={success2}, 3rd_blocked={success3}, has_german_msg={has_german_msg}, error='{error_msg[:80] if error_msg else 'N/A'}'"
        )

    def test_photo_limit_free_tier(self):
        """Test photo limit (Free=8) - 9th photo should return 400"""
        print("\n🔍 Testing Photo Limit (Free Tier)...")
        
        # Create a fresh test user
        timestamp = int(time.time())
        new_user_email = f"phototest{timestamp}@test.com"
        
        success, resp = self.make_request(
            'POST',
            '/auth/register',
            {
                "email": new_user_email,
                "password": "TestPass123!",
                "display_name": "Photo Tester",
                "birth_date": "1995-01-01",
                "gender_identity": "woman",  # Fixed: use "woman" instead of "female"
                "consents": {
                    "terms": True,
                    "privacy": True,
                    "sensitive_data": True,
                    "nsfw_view": True
                }
            }
        )
        
        if not success or not resp:
            self.log_test("Photo limit test - user creation", False, "Failed to create test user")
            return
        
        token = resp.json().get("access_token")
        
        # Small test image (1x1 red pixel)
        test_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        
        # Upload 8 photos (should all succeed)
        upload_results = []
        for i in range(8):
            success, resp = self.make_request(
                'POST',
                '/me/photos',
                {"data_url": test_image, "is_primary": i == 0},
                token=token
            )
            upload_results.append(success)
            if not success:
                break
            time.sleep(0.2)  # Small delay to avoid rate limiting
        
        # Try to upload 9th photo (should fail with 400)
        success9, resp9 = self.make_request(
            'POST',
            '/me/photos',
            {"data_url": test_image, "is_primary": False},
            token=token,
            expected_status=400
        )
        
        error_msg = ""
        has_german_msg = False
        if resp9:
            try:
                data = resp9.json()
                error_msg = data.get("detail", "")
                # Check for German error message mentioning Premium and photos
                has_german_msg = "Premium" in error_msg and ("Foto" in error_msg or "Limit" in error_msg)
            except Exception as e:
                print(f"    ⚠️  Error parsing response: {e}, status={resp9.status_code}")
        
        all_8_succeeded = all(upload_results)
        ninth_blocked = success9 and has_german_msg
        
        self.log_test(
            "Photo limit (Free=8)",
            all_8_succeeded and ninth_blocked,
            f"first_8_uploaded={sum(upload_results)}/8, 9th_blocked={success9}, has_german_msg={has_german_msg}, error='{error_msg[:80] if error_msg else 'N/A'}'"
        )

    def test_first_match_earning(self):
        """Test first-match earning - both users should get +10 sparks"""
        print("\n🔍 Testing First Match Earning...")
        
        # Create two fresh users
        timestamp = int(time.time())
        user1_email = f"match1_{timestamp}@test.com"
        user2_email = f"match2_{timestamp}@test.com"
        
        # Register user 1
        success, resp = self.make_request(
            'POST',
            '/auth/register',
            {
                "email": user1_email,
                "password": "TestPass123!",
                "display_name": "Match User 1",
                "birth_date": "1995-01-01",
                "gender_identity": "man",  # Fixed: use "man" instead of "male"
                "consents": {
                    "terms": True,
                    "privacy": True,
                    "sensitive_data": True,
                    "nsfw_view": True
                }
            }
        )
        
        if not success or not resp:
            self.log_test("First match test - user1 creation", False, "Failed")
            return
        
        token1 = resp.json().get("access_token")
        user1_id = resp.json().get("user", {}).get("id")
        
        # Register user 2
        success, resp = self.make_request(
            'POST',
            '/auth/register',
            {
                "email": user2_email,
                "password": "TestPass123!",
                "display_name": "Match User 2",
                "birth_date": "1995-01-01",
                "gender_identity": "woman",  # Fixed: use "woman" instead of "female"
                "consents": {
                    "terms": True,
                    "privacy": True,
                    "sensitive_data": True,
                    "nsfw_view": True
                }
            }
        )
        
        if not success or not resp:
            self.log_test("First match test - user2 creation", False, "Failed")
            return
        
        token2 = resp.json().get("access_token")
        user2_id = resp.json().get("user", {}).get("id")
        
        # Get initial balances
        success, resp = self.make_request('GET', '/me/sparks', token=token1)
        balance1_before = resp.json().get("balance", 0) if success and resp else 0
        
        success, resp = self.make_request('GET', '/me/sparks', token=token2)
        balance2_before = resp.json().get("balance", 0) if success and resp else 0
        
        # User 1 likes User 2
        success, resp = self.make_request(
            'POST',
            '/likes',
            {"target_user_id": user2_id},
            token=token1
        )
        
        if not success:
            self.log_test("First match test - user1 like", False, "Failed")
            return
        
        # User 2 likes User 1 (creates match)
        success, resp = self.make_request(
            'POST',
            '/likes',
            {"target_user_id": user1_id},
            token=token2
        )
        
        if not success or not resp:
            self.log_test("First match test - user2 like", False, "Failed")
            return
        
        match_created = resp.json().get("matched", False)
        
        time.sleep(1)  # Allow time for sparks to be credited
        
        # Get final balances
        success, resp = self.make_request('GET', '/me/sparks', token=token1)
        balance1_after = resp.json().get("balance", 0) if success and resp else 0
        
        success, resp = self.make_request('GET', '/me/sparks', token=token2)
        balance2_after = resp.json().get("balance", 0) if success and resp else 0
        
        # Both should have received +10 sparks
        user1_got_sparks = (balance1_after - balance1_before) >= 10
        user2_got_sparks = (balance2_after - balance2_before) >= 10
        
        self.log_test(
            "First match earning (+10 sparks each)",
            match_created and user1_got_sparks and user2_got_sparks,
            f"match={match_created}, user1: {balance1_before}→{balance1_after} (+{balance1_after-balance1_before}), user2: {balance2_before}→{balance2_after} (+{balance2_after-balance2_before})"
        )

    def test_backend_regression(self):
        """Test that existing endpoints still work"""
        print("\n🔍 Testing Backend Regression...")
        
        # Test health endpoint
        success, resp = self.make_request('GET', '/health')
        health_ok = success and resp and resp.json().get("status") == "ok"
        self.log_test("Health endpoint", health_ok, f"Status: {resp.json() if resp else 'N/A'}")
        
        # Test /me endpoint
        token = self.tokens.get(self.test_user_creds["email"])
        if token:
            success, resp = self.make_request('GET', '/me', token=token)
            me_ok = success and resp and "id" in resp.json()
            self.log_test("GET /api/me", me_ok, f"Has user data: {bool(resp.json() if resp else False)}")
        
        # Test login still works
        success, resp = self.make_request(
            'POST',
            '/auth/login',
            self.test_user_creds
        )
        login_ok = success and resp and "access_token" in resp.json()
        self.log_test("POST /api/auth/login", login_ok, f"Token received: {bool(resp.json().get('access_token') if resp else False)}")

    def run_all_tests(self):
        """Run all Phase 15.1 tests"""
        print("=" * 70)
        print("🚀 Phase 15.1 Backend Testing - Sparks System")
        print("=" * 70)
        
        # Core Sparks endpoints
        self.test_sparks_balance_endpoint()
        self.test_sparks_ledger_endpoint()
        self.test_daily_login_idempotency()
        
        # Admin functionality
        self.test_admin_sparks_adjust()
        
        # Tier limits
        self.test_album_limit_free_tier()
        self.test_photo_limit_free_tier()
        
        # Earning hooks
        self.test_first_match_earning()
        
        # Regression
        self.test_backend_regression()
        
        # Summary
        print("\n" + "=" * 70)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} passed")
        print("=" * 70)
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for failure in self.failed_tests:
                print(f"  - {failure}")
        
        return 0 if self.tests_passed == self.tests_run else 1


def main():
    tester = Phase15Tester()
    return tester.run_all_tests()


if __name__ == "__main__":
    sys.exit(main())
