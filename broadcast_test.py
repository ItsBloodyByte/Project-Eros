#!/usr/bin/env python3
"""
Backend API Testing for Broadcast History Feature
Tests the German dating app Eros broadcast functionality.
"""
import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional

class BroadcastAPITester:
    def __init__(self, base_url="https://auto-implement-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.user_token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_broadcasts = []  # Track for cleanup

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, params: Optional[Dict] = None, 
                 token: Optional[str] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json().get('detail', 'No detail')
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def login_user(self) -> bool:
        """Login as regular user"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": "testing@test.com", "password": "testpass123"}
        )
        if success and 'access_token' in response:
            self.user_token = response['access_token']
            print(f"   User token obtained: {self.user_token[:20]}...")
            return True
        return False

    def login_admin(self) -> bool:
        """Login as admin user"""
        # Try both possible admin passwords
        for password in ["testpass", "admin123"]:
            success, response = self.run_test(
                f"Admin Login (password: {password})",
                "POST",
                "auth/login",
                200,
                data={"email": "admin@eros.app", "password": password}
            )
            if success and 'access_token' in response:
                self.admin_token = response['access_token']
                print(f"   Admin token obtained: {self.admin_token[:20]}...")
                return True
        return False

    def create_test_broadcast(self, title: str, body: str, severity: str = "info", 
                            pinned: bool = False) -> Optional[str]:
        """Create a test broadcast and return its ID"""
        data = {
            "title": title,
            "body": body,
            "severity": severity,
            "audience": "all",
            "pinned": pinned,
            "expires_at": (datetime.now() + timedelta(days=7)).isoformat()
        }
        
        success, response = self.run_test(
            f"Create Test Broadcast: {title}",
            "POST",
            "admin/broadcasts",
            201,
            data=data,
            token=self.admin_token
        )
        
        if success and 'id' in response:
            broadcast_id = response['id']
            self.created_broadcasts.append(broadcast_id)
            return broadcast_id
        return None

    def test_get_broadcasts_basic(self) -> bool:
        """Test basic GET /me/broadcasts endpoint"""
        success, response = self.run_test(
            "GET /me/broadcasts (basic)",
            "GET",
            "me/broadcasts",
            200,
            token=self.user_token
        )
        
        if success:
            # Check response structure
            required_fields = ['broadcasts', 'total', 'limit', 'skip', 'has_more']
            for field in required_fields:
                if field not in response:
                    print(f"   ❌ Missing field: {field}")
                    return False
            print(f"   ✅ Response structure valid")
            print(f"   ✅ Found {len(response.get('broadcasts', []))} broadcasts")
            return True
        return False

    def test_get_broadcasts_with_filters(self) -> bool:
        """Test GET /me/broadcasts with various filters"""
        test_cases = [
            ("severity filter", {"severity": "info"}),
            ("read_status filter", {"read_status": "unread"}),
            ("include_expired", {"include_expired": "true"}),
            ("search filter", {"search": "Test"}),
            ("pagination", {"skip": "0", "limit": "5"}),
            ("date filter", {"since": (datetime.now() - timedelta(days=30)).isoformat()}),
        ]
        
        all_passed = True
        for test_name, params in test_cases:
            success, response = self.run_test(
                f"GET /me/broadcasts ({test_name})",
                "GET",
                "me/broadcasts",
                200,
                params=params,
                token=self.user_token
            )
            if not success:
                all_passed = False
            else:
                print(f"   ✅ {test_name}: {len(response.get('broadcasts', []))} results")
        
        return all_passed

    def test_ack_individual_broadcast(self) -> bool:
        """Test POST /me/broadcasts/{id}/ack"""
        # First get a broadcast to acknowledge
        success, response = self.run_test(
            "GET broadcasts for ack test",
            "GET",
            "me/broadcasts",
            200,
            params={"limit": "1"},
            token=self.user_token
        )
        
        if not success or not response.get('broadcasts'):
            print("   ⚠️ No broadcasts available for ack test")
            return True  # Not a failure, just no data
        
        broadcast_id = response['broadcasts'][0]['id']
        
        success, response = self.run_test(
            f"POST /me/broadcasts/{broadcast_id}/ack",
            "POST",
            f"me/broadcasts/{broadcast_id}/ack",
            200,
            token=self.user_token
        )
        
        return success

    def test_ack_all_broadcasts(self) -> bool:
        """Test POST /me/broadcasts/ack-all"""
        success, response = self.run_test(
            "POST /me/broadcasts/ack-all",
            "POST",
            "me/broadcasts/ack-all",
            200,
            token=self.user_token
        )
        
        if success:
            if 'ok' in response and 'marked' in response:
                print(f"   ✅ Marked {response.get('marked', 0)} broadcasts as read")
                return True
            else:
                print(f"   ❌ Invalid response structure: {response}")
                return False
        return False

    def test_backward_compatibility(self) -> bool:
        """Test backward compatibility with existing BroadcastBanner call"""
        success, response = self.run_test(
            "GET /me/broadcasts (backward compatibility)",
            "GET",
            "me/broadcasts",
            200,
            params={"unread_only": "true", "limit": "10"},
            token=self.user_token
        )
        
        if success:
            # Should have the same structure as new endpoint
            required_fields = ['broadcasts', 'total', 'limit', 'skip', 'has_more']
            for field in required_fields:
                if field not in response:
                    print(f"   ❌ Missing field for backward compatibility: {field}")
                    return False
            print(f"   ✅ Backward compatibility maintained")
            return True
        return False

    def cleanup_test_broadcasts(self):
        """Clean up created test broadcasts"""
        print(f"\n🧹 Cleaning up {len(self.created_broadcasts)} test broadcasts...")
        for broadcast_id in self.created_broadcasts:
            try:
                success, _ = self.run_test(
                    f"Delete broadcast {broadcast_id}",
                    "DELETE",
                    f"admin/broadcasts/{broadcast_id}",
                    200,
                    token=self.admin_token
                )
                if success:
                    print(f"   ✅ Deleted broadcast {broadcast_id}")
                else:
                    print(f"   ⚠️ Could not delete broadcast {broadcast_id}")
            except Exception as e:
                print(f"   ⚠️ Error deleting broadcast {broadcast_id}: {e}")

def main():
    print("🚀 Starting Broadcast History Backend API Tests")
    print("=" * 60)
    
    tester = BroadcastAPITester()
    
    # Login tests
    if not tester.login_user():
        print("❌ User login failed, stopping tests")
        return 1
    
    if not tester.login_admin():
        print("❌ Admin login failed, stopping tests")
        return 1
    
    # Create some test broadcasts for testing
    print("\n📝 Creating test broadcasts...")
    tester.create_test_broadcast(
        "Test-Info Broadcast", 
        "Dies ist eine Test-Info-Mitteilung für die Broadcast-Historie.", 
        "info"
    )
    tester.create_test_broadcast(
        "Test-Warning Broadcast", 
        "Dies ist eine Test-Warnung für die Broadcast-Historie.", 
        "warning", 
        pinned=True
    )
    tester.create_test_broadcast(
        "Test-Urgent Broadcast", 
        "Dies ist eine dringende Test-Mitteilung für die Broadcast-Historie.", 
        "urgent"
    )
    
    # Run broadcast API tests
    print("\n🔍 Testing Broadcast API Endpoints...")
    
    tests = [
        tester.test_get_broadcasts_basic,
        tester.test_get_broadcasts_with_filters,
        tester.test_backward_compatibility,
        tester.test_ack_individual_broadcast,
        tester.test_ack_all_broadcasts,
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test {test.__name__} failed with exception: {e}")
    
    # Cleanup
    tester.cleanup_test_broadcasts()
    
    # Print results
    print(f"\n📊 Test Results:")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())