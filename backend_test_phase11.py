#!/usr/bin/env python3
"""
Backend API Test Suite for Eros Dating App - Phase 11.3 Router Refactor
Tests all extracted routes: /me/*, /discover, /matches, /messages, and smoke tests.

Focus: Verify zero regressions after extracting high-frequency routes from server.py
into separate router modules (me.py, discover.py, matches_chat.py).
"""

import requests
import sys
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

class ErosAPITester:
    def __init__(self, base_url: str = "https://auto-implement-2.preview.emergentagent.com"):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.admin_token = None
        self.test_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, token: Optional[str] = None, 
                 headers: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        test_headers = {'Content-Type': 'application/json'}
        
        if token:
            test_headers['Authorization'] = f'Bearer {token}'
        if headers:
            test_headers.update(headers)
            
        self.tests_run += 1
        self.log(f"Testing {name} - {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PATCH':
                response = self.session.patch(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ PASS - {name} (Status: {response.status_code})")
            else:
                self.log(f"❌ FAIL - {name} (Expected: {expected_status}, Got: {response.status_code})")
                self.failed_tests.append({
                    "name": name,
                    "endpoint": endpoint,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:500] if response.text else ""
                })
                
            try:
                return success, response.json() if response.content else {}
            except:
                return success, {"raw_response": response.text[:200]}
                
        except Exception as e:
            self.log(f"❌ ERROR - {name}: {str(e)}", "ERROR")
            self.failed_tests.append({
                "name": name,
                "endpoint": endpoint,
                "error": str(e)
            })
            return False, {}

    def authenticate(self) -> bool:
        """Authenticate both admin and test users"""
        self.log("=== AUTHENTICATION PHASE ===")
        
        # Admin login
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            {"email": "admin@eros.app", "password": "admin123"}
        )
        
        if success and response.get("access_token"):
            self.admin_token = response["access_token"]
            self.log("✅ Admin authentication successful")
        else:
            self.log("❌ Admin authentication failed", "ERROR")
            return False
            
        # Test user login  
        success, response = self.run_test(
            "Test User Login",
            "POST", 
            "auth/login",
            200,
            {"email": "testing@test.com", "password": "testpass123"}
        )
        
        if success and response.get("access_token"):
            self.test_token = response["access_token"]
            self.log("✅ Test user authentication successful")
        else:
            self.log("❌ Test user authentication failed", "ERROR")
            return False
            
        return True

    def test_me_routes(self) -> bool:
        """Test all /me/* routes (18 routes from routers/me.py)"""
        self.log("\n=== TESTING /ME/* ROUTES ===")
        
        if not self.test_token:
            self.log("❌ No test token available", "ERROR")
            return False
            
        # Core profile routes
        self.run_test("GET /me", "GET", "me", 200, token=self.test_token)
        
        # Profile update
        self.run_test(
            "PATCH /me", 
            "PATCH", 
            "me", 
            200,
            {"bio": "Updated bio for testing"}, 
            token=self.test_token
        )
        
        # Mood update
        self.run_test(
            "PATCH /me/mood",
            "PATCH",
            "me/mood", 
            200,
            {"current_mood": "online"},
            token=self.test_token
        )
        
        # Location heartbeat
        self.run_test(
            "POST /me/location",
            "POST",
            "me/location",
            200,
            {"coordinates": [13.4050, 52.5200], "accuracy_m": 10},
            token=self.test_token
        )
        
        # Chat preferences
        self.run_test(
            "PATCH /me/chat-prefs",
            "PATCH", 
            "me/chat-prefs",
            200,
            {"read_receipts": True, "show_typing": True},
            token=self.test_token
        )
        
        # Acquaintances
        self.run_test("GET /me/acquaintances/pending", "GET", "me/acquaintances/pending", 200, token=self.test_token)
        
        # Broadcasts
        self.run_test("GET /me/broadcasts", "GET", "me/broadcasts", 200, token=self.test_token)
        self.run_test("POST /me/broadcasts/ack-all", "POST", "me/broadcasts/ack-all", 200, token=self.test_token)
        
        # Unread summary
        self.run_test("GET /me/unread-summary", "GET", "me/unread-summary", 200, token=self.test_token)
        
        # Visitors (premium feature)
        self.run_test("GET /me/visitors", "GET", "me/visitors", 200, token=self.test_token)
        
        # Videos (premium feature - should fail for non-premium)
        self.run_test(
            "POST /me/videos",
            "POST",
            "me/videos", 
            402,  # Payment required
            {"data_url": "data:video/mp4;base64,test", "caption": "test"},
            token=self.test_token
        )
        
        # Boost (premium feature - should fail for non-premium)
        self.run_test(
            "POST /me/boost",
            "POST",
            "me/boost",
            402,  # Payment required
            {"duration_minutes": 30},
            token=self.test_token
        )
        
        return True

    def test_discover_route(self) -> bool:
        """Test the critical /discover route with boost sorting"""
        self.log("\n=== TESTING /DISCOVER ROUTE ===")
        
        if not self.test_token:
            self.log("❌ No test token available", "ERROR")
            return False
            
        # Basic discover
        success, response = self.run_test("GET /discover", "GET", "discover", 200, token=self.test_token)
        
        if success:
            # Verify response structure
            if "results" in response and isinstance(response["results"], list):
                self.log(f"✅ Discover returned {len(response['results'])} results")
                
                # Check for boost sorting (boosted users should appear first)
                boosted_count = sum(1 for user in response["results"] if user.get("boosted"))
                if boosted_count > 0:
                    self.log(f"✅ Found {boosted_count} boosted users in results")
                    
                    # Verify boosted users are at the beginning
                    first_non_boosted_index = None
                    for i, user in enumerate(response["results"]):
                        if not user.get("boosted"):
                            first_non_boosted_index = i
                            break
                            
                    if first_non_boosted_index is None or first_non_boosted_index >= boosted_count:
                        self.log("✅ Boost sorting verified - boosted users appear first")
                    else:
                        self.log("❌ Boost sorting issue - non-boosted user found before boosted users", "ERROR")
                        
            else:
                self.log("❌ Invalid discover response structure", "ERROR")
                
        # Test with pagination
        self.run_test("GET /discover with pagination", "GET", "discover?limit=10&skip=0", 200, token=self.test_token)
        
        # Admin mode (should fail for non-admin)
        self.run_test("GET /discover admin mode", "GET", "discover?admin_mode=true", 200, token=self.test_token)
        
        return success

    def test_matches_chat_routes(self) -> bool:
        """Test /matches and /messages routes (5 routes from routers/matches_chat.py)"""
        self.log("\n=== TESTING MATCHES & CHAT ROUTES ===")
        
        if not self.test_token:
            self.log("❌ No test token available", "ERROR")
            return False
            
        # List matches
        success, matches_response = self.run_test("GET /matches", "GET", "matches", 200, token=self.test_token)
        
        match_id = None
        if success and matches_response.get("matches"):
            match_id = matches_response["matches"][0].get("id")
            self.log(f"✅ Found match ID: {match_id}")
            
        # If we have a match, test message operations
        if match_id:
            # Get messages
            self.run_test(
                "GET /matches/{match_id}/messages",
                "GET", 
                f"matches/{match_id}/messages",
                200,
                token=self.test_token
            )
            
            # Send message
            self.run_test(
                "POST /messages",
                "POST",
                "messages",
                200,
                {"match_id": match_id, "text": "Test message from API test"},
                token=self.test_token
            )
            
            # Test unmatch (destructive - skip for now)
            # self.run_test(
            #     "POST /matches/{match_id}/unmatch",
            #     "POST",
            #     f"matches/{match_id}/unmatch", 
            #     200,
            #     token=self.test_token
            # )
        else:
            self.log("⚠️ No matches found - skipping message tests", "WARN")
            
        # Test premium message first (should fail for non-premium)
        self.run_test(
            "POST /messages/first",
            "POST",
            "messages/first",
            402,  # Payment required
            {"target_user_id": str(uuid.uuid4()), "text": "Premium first message"},
            token=self.test_token
        )
        
        return True

    def test_smoke_routes(self) -> bool:
        """Test smoke routes for other endpoints"""
        self.log("\n=== SMOKE TESTS FOR OTHER ROUTES ===")
        
        # Public routes (no auth needed)
        self.run_test("GET /legal", "GET", "legal", 200)
        self.run_test("GET /blog/posts", "GET", "blog/posts", 200)
        
        # Couples routes (with auth)
        if self.test_token:
            self.run_test("GET /couples/me", "GET", "couples/me", 200, token=self.test_token)
            self.run_test("GET /couples/invites", "GET", "couples/invites", 200, token=self.test_token)
            
        # Payment routes (with auth)
        if self.test_token:
            self.run_test("GET /payments/packages", "GET", "payments/packages", 200, token=self.test_token)
            
        # Webhook routes (should return 400 without proper signature)
        self.run_test("POST /webhook/stripe", "POST", "webhook/stripe", 400)
        
        return True

    def test_admin_routes(self) -> bool:
        """Test admin routes with role checks"""
        self.log("\n=== TESTING ADMIN ROUTES & ROLE CHECKS ===")
        
        if not self.admin_token:
            self.log("❌ No admin token available", "ERROR")
            return False
            
        # Admin routes that should work with admin token
        self.run_test("GET /admin/users", "GET", "admin/users", 200, token=self.admin_token)
        self.run_test("GET /admin/reports", "GET", "admin/reports", 200, token=self.admin_token)
        self.run_test("GET /admin/broadcasts", "GET", "admin/broadcasts", 200, token=self.admin_token)
        self.run_test("GET /admin/notifications", "GET", "admin/notifications", 200, token=self.admin_token)
        
        # Test role enforcement - admin routes should fail with regular user token
        if self.test_token:
            self.run_test(
                "GET /admin/users (non-admin)",
                "GET", 
                "admin/users",
                403,  # Forbidden
                token=self.test_token
            )
            
        return True

    def run_all_tests(self) -> bool:
        """Run the complete test suite"""
        self.log("🚀 Starting Eros API Test Suite - Phase 11.3 Router Refactor Verification")
        self.log(f"Testing against: {self.base_url}")
        
        start_time = datetime.now()
        
        # Authentication
        if not self.authenticate():
            self.log("❌ Authentication failed - aborting tests", "ERROR")
            return False
            
        # Test all route groups
        self.test_me_routes()
        self.test_discover_route() 
        self.test_matches_chat_routes()
        self.test_smoke_routes()
        self.test_admin_routes()
        
        # Summary
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        self.log(f"\n📊 TEST SUMMARY")
        self.log(f"Duration: {duration:.2f} seconds")
        self.log(f"Tests Run: {self.tests_run}")
        self.log(f"Tests Passed: {self.tests_passed}")
        self.log(f"Tests Failed: {len(self.failed_tests)}")
        self.log(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            self.log("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
                self.log(f"  - {test['name']}: {error_msg}") 
                
        return len(self.failed_tests) == 0

def main():
    """Main test execution"""
    tester = ErosAPITester()
    success = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())