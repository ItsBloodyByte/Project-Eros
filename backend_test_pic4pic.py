#!/usr/bin/env python3
"""
Backend API testing for Pic4Pic feature and Landing page.
Tests the newly implemented Pic4Pic endpoints and verifies landing page API.
"""

import requests
import json
import base64
import sys
from datetime import datetime

class Pic4PicTester:
    def __init__(self, base_url="https://auto-implement-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.tokens = {}
        self.users = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Test credentials
        self.test_users = {
            "admin@eros.app": {"password": "admin123"},
            "testing@test.com": {"password": "testpass123"}
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
            return success, response
        except Exception as e:
            print(f"    Request error: {str(e)}")
            return False, None

    def get_test_image_data_url(self):
        """Generate a simple test image as base64 data URL"""
        # Minimal 1x1 red PNG
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        )
        b64_data = base64.b64encode(png_data).decode()
        return f"data:image/png;base64,{b64_data}"

    def test_login(self):
        """Test login for test users"""
        print("\n🔍 Testing Login...")
        
        for email, creds in self.test_users.items():
            login_data = {"email": email, "password": creds["password"]}
            success, resp = self.make_request('POST', '/auth/login', login_data)
            
            if success and resp:
                data = resp.json()
                if "access_token" in data and "user" in data:
                    self.tokens[email] = data["access_token"]
                    self.users[email] = data["user"]
                    self.log_test(f"Login {email}", True, f"User ID: {data['user'].get('id')}")
                else:
                    self.log_test(f"Login {email}", False, "Missing token or user data")
            else:
                self.log_test(f"Login {email}", False, 
                             f"Status: {resp.status_code if resp else 'No response'}")

    def test_landing_endpoint(self):
        """Test public landing page endpoint"""
        print("\n🔍 Testing Landing Page Endpoint...")
        
        # Test GET /api/landing (public endpoint, no auth required)
        success, resp = self.make_request('GET', '/landing')
        if success and resp:
            data = resp.json()
            has_landing = "landing" in data
            has_hero = has_landing and "hero" in data.get("landing", {})
            has_sections = has_landing and "sections" in data.get("landing", {})
            
            self.log_test("GET /api/landing", has_landing and has_hero,
                         f"Has landing: {has_landing}, Has hero: {has_hero}, Has sections: {has_sections}")
            
            if has_hero:
                hero = data["landing"]["hero"]
                has_headline = "headline" in hero
                has_cta = "cta_primary" in hero or "cta_secondary" in hero
                self.log_test("Landing hero structure", has_headline and has_cta,
                             f"Headline: {hero.get('headline', '')[:50]}...")
        else:
            self.log_test("GET /api/landing", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")

    def ensure_match(self):
        """Ensure testing@test.com has at least one match for Pic4Pic testing"""
        print("\n🔍 Ensuring Match Exists...")
        
        test_token = self.tokens.get("testing@test.com")
        if not test_token:
            print("    ⚠️  Testing token not available, skipping match creation")
            return None
        
        # Get matches
        success, resp = self.make_request('GET', '/matches', token=test_token)
        if success and resp:
            data = resp.json()
            matches = data.get("matches", [])
            if matches:
                match_id = matches[0]["id"]
                self.log_test("Match exists", True, f"Match ID: {match_id}")
                return match_id
            else:
                print("    ⚠️  No matches found for testing@test.com")
                print("    Note: Pic4Pic requires an existing match. Skipping Pic4Pic flow tests.")
                return None
        else:
            print("    ⚠️  Failed to get matches")
            return None

    def test_pic4pic_endpoints(self):
        """Test Pic4Pic endpoints"""
        print("\n🔍 Testing Pic4Pic Endpoints...")
        
        test_token = self.tokens.get("testing@test.com")
        if not test_token:
            self.log_test("Pic4Pic tests", False, "Testing token not available")
            return
        
        # Ensure we have a match
        match_id = self.ensure_match()
        if not match_id:
            self.log_test("Pic4Pic tests", False, "No match available for testing")
            return
        
        # Test GET /api/pic4pic/match/{match_id} - should return null or existing exchange
        success, resp = self.make_request('GET', f'/pic4pic/match/{match_id}', token=test_token)
        if success and resp:
            data = resp.json()
            has_exchange_key = "exchange" in data
            self.log_test("GET /api/pic4pic/match/{match_id}", has_exchange_key,
                         f"Exchange: {data.get('exchange')}")
            
            # If there's an existing exchange, cancel it first
            existing_exchange = data.get("exchange")
            if existing_exchange and existing_exchange.get("status") == "pending":
                cancel_data = {"exchange_id": existing_exchange["id"]}
                cancel_success, _ = self.make_request('POST', '/pic4pic/cancel', cancel_data, token=test_token)
                if cancel_success:
                    print("    Cancelled existing pending exchange")
        else:
            self.log_test("GET /api/pic4pic/match/{match_id}", False,
                         f"Status: {resp.status_code if resp else 'No response'}")
            return
        
        # Test POST /api/pic4pic/initiate
        initiate_data = {
            "match_id": match_id,
            "data_url": self.get_test_image_data_url()
        }
        success, resp = self.make_request('POST', '/pic4pic/initiate', initiate_data, token=test_token)
        if success and resp:
            data = resp.json()
            has_exchange = "exchange" in data
            exchange_id = data.get("exchange", {}).get("id")
            
            self.log_test("POST /api/pic4pic/initiate", has_exchange and exchange_id,
                         f"Exchange ID: {exchange_id}, Status: {data.get('exchange', {}).get('status')}")
            
            if exchange_id:
                # Test GET /api/pic4pic/match/{match_id} again - should return pending exchange
                success2, resp2 = self.make_request('GET', f'/pic4pic/match/{match_id}', token=test_token)
                if success2 and resp2:
                    data2 = resp2.json()
                    exchange = data2.get("exchange")
                    is_pending = exchange and exchange.get("status") == "pending"
                    your_role = exchange.get("your_role") if exchange else None
                    
                    self.log_test("GET /api/pic4pic/match/{match_id} - Pending state", is_pending,
                                 f"Status: {exchange.get('status') if exchange else 'None'}, Role: {your_role}")
                
                # Test POST /api/pic4pic/cancel
                cancel_data = {"exchange_id": exchange_id}
                success3, resp3 = self.make_request('POST', '/pic4pic/cancel', cancel_data, token=test_token)
                if success3 and resp3:
                    data3 = resp3.json()
                    self.log_test("POST /api/pic4pic/cancel", data3.get("ok") == True,
                                 f"Response: {data3}")
                    
                    # Verify exchange is cancelled
                    success4, resp4 = self.make_request('GET', f'/pic4pic/match/{match_id}', token=test_token)
                    if success4 and resp4:
                        data4 = resp4.json()
                        exchange = data4.get("exchange")
                        is_cancelled = exchange and exchange.get("status") == "cancelled"
                        self.log_test("Pic4Pic cancel verification", is_cancelled,
                                     f"Status: {exchange.get('status') if exchange else 'None'}")
                else:
                    self.log_test("POST /api/pic4pic/cancel", False,
                                 f"Status: {resp3.status_code if resp3 else 'No response'}")
        else:
            self.log_test("POST /api/pic4pic/initiate", False,
                         f"Status: {resp.status_code if resp else 'No response'}")

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test}")
        
        print("="*60)
        return 0 if self.tests_passed == self.tests_run else 1

def main():
    tester = Pic4PicTester()
    
    # Run tests
    tester.test_login()
    tester.test_landing_endpoint()
    tester.test_pic4pic_endpoints()
    
    return tester.print_summary()

if __name__ == "__main__":
    sys.exit(main())
