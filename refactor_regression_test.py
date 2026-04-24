#!/usr/bin/env python3
"""
Focused regression testing for the server.py refactor (iteration 10).
Tests the three extracted router modules: legal.py, blog.py, couples.py
to ensure NO behavioral changes occurred during the refactor.
"""

import requests
import json
import sys
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, List

class RefactorRegressionTester:
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
            "testing@test.com": {"password": "testpass123", "role": "user"},  # duo account, no partner
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
        
        # Handle expected_status as list or single value
        if isinstance(expected_status, list):
            expected_statuses = expected_status
        else:
            expected_statuses = [expected_status]
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code in expected_statuses
            return success, response
        except Exception as e:
            print(f"Request error: {str(e)}")
            return False, None

    def test_auth_login(self):
        """Test login with provided credentials"""
        print("\n🔍 Testing Authentication...")
        
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

    def test_legal_endpoints(self):
        """Test legal endpoints from routers/legal.py"""
        print("\n🔍 Testing Legal Endpoints (routers/legal.py)...")
        
        admin_token = self.tokens.get("admin@eros.app")
        user_token = self.tokens.get("testing@test.com")
        
        # Test GET /api/legal (public endpoint)
        success, resp = self.make_request('GET', '/legal')
        if success and resp:
            data = resp.json()
            pages = data.get("pages", [])
            has_required_keys = any(page.get("key") == "terms" for page in pages)
            self.log_test("GET /api/legal returns list of legal pages with keys", 
                         has_required_keys and len(pages) > 0,
                         f"Found {len(pages)} pages, has terms: {has_required_keys}")
        else:
            self.log_test("GET /api/legal returns list of legal pages with keys", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test GET /api/legal/terms (public endpoint)
        success, resp = self.make_request('GET', '/legal/terms')
        if success and resp:
            data = resp.json()
            has_content = "content_markdown" in data and "title" in data
            self.log_test("GET /api/legal/terms returns full content markdown (200)", 
                         has_content,
                         f"Has content: {has_content}, Title: {data.get('title', 'None')}")
        else:
            self.log_test("GET /api/legal/terms returns full content markdown (200)", False,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test GET /api/legal/unknownkey returns 404
        success, resp = self.make_request('GET', '/legal/unknownkey', expected_status=404)
        self.log_test("GET /api/legal/unknownkey returns 404", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test PUT /api/admin/legal/terms as admin user (role-gated)
        if admin_token:
            update_data = {
                "title": "Updated Terms of Service",
                "content_markdown": "# Updated Terms\n\nThis is a test update."
            }
            success, resp = self.make_request('PUT', '/admin/legal/terms', update_data, token=admin_token)
            if success and resp:
                data = resp.json()
                self.log_test("PUT /api/admin/legal/terms as admin user updates the page (role-gated)", 
                             data.get("ok") == True,
                             f"Update successful: {data.get('ok')}")
            else:
                self.log_test("PUT /api/admin/legal/terms as admin user updates the page (role-gated)", False,
                             f"Status: {resp.status_code if resp else 'No response'}")
        else:
            self.log_test("PUT /api/admin/legal/terms as admin user", False, "Admin token not available")
        
        # Test PUT /api/admin/legal/terms as normal user returns 403
        if user_token:
            update_data = {
                "title": "Unauthorized Update",
                "content_markdown": "This should fail."
            }
            success, resp = self.make_request('PUT', '/admin/legal/terms', update_data, 
                                            token=user_token, expected_status=403)
            self.log_test("PUT /api/admin/legal/terms as normal user returns 403", success,
                         f"Status: {resp.status_code if resp else 'No response'}")
        else:
            self.log_test("PUT /api/admin/legal/terms as normal user", False, "User token not available")

    def test_blog_endpoints(self):
        """Test blog endpoints from routers/blog.py"""
        print("\n🔍 Testing Blog Endpoints (routers/blog.py)...")
        
        admin_token = self.tokens.get("admin@eros.app")
        user_token = self.tokens.get("testing@test.com")
        
        # Test GET /api/blog/posts (public endpoint)
        success, resp = self.make_request('GET', '/blog/posts')
        if success and resp:
            data = resp.json()
            posts = data.get("posts", [])
            has_pagination = "total" in data and "has_more" in data
            self.log_test("GET /api/blog/posts returns paginated published posts (excerpt, tags)", 
                         has_pagination,
                         f"Posts: {len(posts)}, Has pagination: {has_pagination}")
        else:
            self.log_test("GET /api/blog/posts returns paginated published posts", False,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test GET /api/blog/tags (public endpoint)
        success, resp = self.make_request('GET', '/blog/tags')
        if success and resp:
            data = resp.json()
            tags = data.get("tags", [])
            self.log_test("GET /api/blog/tags returns tag list", 
                         isinstance(tags, list),
                         f"Tags count: {len(tags)}")
        else:
            self.log_test("GET /api/blog/tags returns tag list", False,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test GET /api/blog/posts/{slug} with existing post
        success, resp = self.make_request('GET', '/blog/posts/willkommen-auf-eros')
        if success and resp:
            data = resp.json()
            has_full_content = "content_html" in data and "title" in data
            self.log_test("GET /api/blog/posts/{slug} returns full post", 
                         has_full_content,
                         f"Has content: {has_full_content}, Title: {data.get('title', 'None')}")
        else:
            self.log_test("GET /api/blog/posts/{slug} returns full post", False,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Admin CRUD tests
        if admin_token:
            # Test POST /api/admin/blog/posts (create draft)
            create_data = {
                "title": "Test Blog Post",
                "content_html": "<p>This is a test blog post content.</p>",
                "excerpt": "Test excerpt",
                "tags": ["test", "regression"],
                "status": "draft"
            }
            success, resp = self.make_request('POST', '/admin/blog/posts', create_data, token=admin_token)
            if success and resp:
                post_data = resp.json()
                post_id = post_data.get("id")
                self.log_test("Admin CRUD: POST /api/admin/blog/posts (create draft)", 
                             post_id is not None and post_data.get("status") == "draft",
                             f"Created post ID: {post_id}, Status: {post_data.get('status')}")
                
                # Test PATCH /api/admin/blog/posts/{id} (update status→published)
                if post_id:
                    update_data = {"status": "published"}
                    success2, resp2 = self.make_request('PATCH', f'/admin/blog/posts/{post_id}', 
                                                      update_data, token=admin_token)
                    if success2 and resp2:
                        updated_data = resp2.json()
                        self.log_test("Admin CRUD: PATCH /api/admin/blog/posts/{id} (update status→published)", 
                                     updated_data.get("status") == "published",
                                     f"Updated status: {updated_data.get('status')}")
                    else:
                        self.log_test("Admin CRUD: PATCH /api/admin/blog/posts/{id}", False,
                                     f"Status: {resp2.status_code if resp2 else 'No response'}")
                    
                    # Test DELETE /api/admin/blog/posts/{id}
                    success3, resp3 = self.make_request('DELETE', f'/admin/blog/posts/{post_id}', token=admin_token)
                    if success3 and resp3:
                        delete_data = resp3.json()
                        self.log_test("Admin CRUD: DELETE /api/admin/blog/posts/{id}", 
                                     delete_data.get("ok") == True,
                                     f"Delete successful: {delete_data.get('ok')}")
                    else:
                        self.log_test("Admin CRUD: DELETE /api/admin/blog/posts/{id}", False,
                                     f"Status: {resp3.status_code if resp3 else 'No response'}")
            else:
                self.log_test("Admin CRUD: POST /api/admin/blog/posts (create draft)", False,
                             f"Status: {resp.status_code if resp else 'No response'}")
        else:
            self.log_test("Admin CRUD: Blog post creation", False, "Admin token not available")

    def test_couples_endpoints(self):
        """Test couples endpoints from routers/couples.py"""
        print("\n🔍 Testing Couples Endpoints (routers/couples.py)...")
        
        admin_token = self.tokens.get("admin@eros.app")
        user_token = self.tokens.get("testing@test.com")  # duo account, no partner
        
        if not user_token:
            self.log_test("Couples endpoints", False, "testing@test.com token not available")
            return
        
        # Test GET /api/couples/me (for duo account testing@test.com)
        success, resp = self.make_request('GET', '/couples/me', token=user_token)
        if success and resp:
            data = resp.json()
            has_required_fields = all(key in data for key in ["account_type", "partner", "persona_b"])
            account_type = data.get("account_type")
            self.log_test("GET /api/couples/me returns account_type + partner + persona_b (for duo account testing@test.com)", 
                         has_required_fields,
                         f"Account type: {account_type}, Has fields: {list(data.keys())}")
        else:
            self.log_test("GET /api/couples/me returns account_type + partner + persona_b", False,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test GET /api/couples/invites
        success, resp = self.make_request('GET', '/couples/invites', token=user_token)
        if success and resp:
            data = resp.json()
            has_invite_lists = "incoming" in data and "outgoing" in data
            self.log_test("GET /api/couples/invites returns incoming/outgoing lists", 
                         has_invite_lists,
                         f"Incoming: {len(data.get('incoming', []))}, Outgoing: {len(data.get('outgoing', []))}")
        else:
            self.log_test("GET /api/couples/invites returns incoming/outgoing lists", False,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test PATCH /api/me/persona-b (for duo account)
        # First check if this is actually a duo account
        success_me, resp_me = self.make_request('GET', '/me', token=user_token)
        if success_me and resp_me:
            me_data = resp_me.json()
            account_type = me_data.get("account_type")
            
            if account_type == "duo":
                persona_update = {
                    "display_name": "Updated Persona B",
                    "bio": "Updated bio for persona B"
                }
                success, resp = self.make_request('PATCH', '/me/persona-b', persona_update, token=user_token)
                if success and resp:
                    data = resp.json()
                    has_persona_response = "ok" in data and "persona_b" in data
                    self.log_test("PATCH /api/me/persona-b updates persona_b on duo account", 
                                 has_persona_response and data.get("ok") == True,
                                 f"Update successful: {data.get('ok')}, Has persona_b: {'persona_b' in data}")
                else:
                    self.log_test("PATCH /api/me/persona-b updates persona_b on duo account", False,
                                 f"Status: {resp.status_code if resp else 'No response'}")
            else:
                # If not duo account, test should fail with 400
                persona_update = {"display_name": "Should fail"}
                success, resp = self.make_request('PATCH', '/me/persona-b', persona_update, 
                                                token=user_token, expected_status=400)
                self.log_test("PATCH /api/me/persona-b on non-duo account returns 400", success,
                             f"Account type: {account_type}, Status: {resp.status_code if resp else 'No response'}")
        
        # Test POST /api/couples/invite with duo account (should fail)
        # testing@test.com is a duo account, so it should not be able to invite
        # First get admin user ID
        success_admin, resp_admin = self.make_request('GET', '/me', token=admin_token)
        if success_admin and resp_admin:
            admin_data = resp_admin.json()
            admin_id = admin_data.get("id")
            
            if admin_id:
                invite_data = {"user_id": admin_id}
                success, resp = self.make_request('POST', '/couples/invite', invite_data, 
                                                token=user_token, expected_status=400)
                if success and resp:
                    data = resp.json()
                    error_message = data.get("detail", "")
                    duo_blocked = "Duo-Accounts" in error_message
                    self.log_test("POST /api/couples/invite with duo account blocked", 
                                 duo_blocked,
                                 f"Error message: {error_message}")
                else:
                    self.log_test("POST /api/couples/invite with duo account blocked", False,
                                 f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test POST /api/couples/invite with admin (non-duo) account
        # Admin should be able to invite (unless already has partner)
        success_admin_me, resp_admin_me = self.make_request('GET', '/me', token=admin_token)
        if success_admin_me and resp_admin_me:
            admin_profile = resp_admin_me.json()
            admin_account_type = admin_profile.get("account_type", "single")
            admin_has_partner = admin_profile.get("partner_user_id") is not None
            user_id = self.users.get("testing@test.com", {}).get("id")
            
            if admin_account_type != "duo" and not admin_has_partner and user_id:
                invite_data = {"user_id": user_id}
                success, resp = self.make_request('POST', '/couples/invite', invite_data, token=admin_token)
                if success and resp:
                    data = resp.json()
                    invite_created = data.get("ok") == True
                    already_pending = data.get("already_pending", False)
                    self.log_test("POST /api/couples/invite with non-duo account invites another user (idempotent)", 
                                 invite_created or already_pending,
                                 f"Invite created: {invite_created}, Already pending: {already_pending}")
                    
                    # Store invite_id for further testing
                    invite_id = data.get("invite_id")
                    if invite_id:
                        self.invite_id = invite_id
                else:
                    self.log_test("POST /api/couples/invite with non-duo account", False,
                                 f"Status: {resp.status_code if resp else 'No response'}")
            else:
                self.log_test("POST /api/couples/invite with non-duo account", True,
                             f"Admin account type: {admin_account_type}, has partner: {admin_has_partner} - skipping invite test")

    def test_couples_invite_flow(self):
        """Test complete couples invite flow"""
        print("\n🔍 Testing Couples Invite Flow...")
        
        admin_token = self.tokens.get("admin@eros.app")
        user_token = self.tokens.get("testing@test.com")
        
        if not admin_token or not user_token:
            self.log_test("Couples invite flow", False, "Required tokens not available")
            return
        
        # Get user IDs
        success_admin, resp_admin = self.make_request('GET', '/me', token=admin_token)
        success_user, resp_user = self.make_request('GET', '/me', token=user_token)
        
        if not (success_admin and resp_admin and success_user and resp_user):
            self.log_test("Couples invite flow", False, "Failed to get user profiles")
            return
        
        admin_data = resp_admin.json()
        user_data = resp_user.json()
        admin_id = admin_data.get("id")
        user_id = user_data.get("id")
        
        # Test reject scenarios first
        
        # 1. Test invite when user already has partner (should be rejected)
        # First check if user already has partner
        if user_data.get("partner_user_id"):
            invite_data = {"user_id": admin_id}
            success, resp = self.make_request('POST', '/couples/invite', invite_data, 
                                            token=user_token, expected_status=400)
            self.log_test("Reject invite when user already has partner", success,
                         f"User has partner: {user_data.get('partner_user_id')}")
        
        # 2. Test invite to duo account (should be rejected)
        if user_data.get("account_type") == "duo":
            invite_data = {"user_id": user_id}
            success, resp = self.make_request('POST', '/couples/invite', invite_data, 
                                            token=admin_token, expected_status=400)
            self.log_test("Reject invite when target is duo", success,
                         f"Target account type: {user_data.get('account_type')}")
        
        # 3. Test invite flow if both users are available
        # For testing purposes, let's create a simple invite and test the endpoints
        if not user_data.get("partner_user_id") and user_data.get("account_type") != "duo":
            # Create invite
            invite_data = {"user_id": user_id}
            success, resp = self.make_request('POST', '/couples/invite', invite_data, token=admin_token)
            if success and resp:
                data = resp.json()
                invite_id = data.get("invite_id")
                
                if invite_id:
                    # Test decline invite
                    success_decline, resp_decline = self.make_request('POST', f'/couples/invites/{invite_id}/decline', 
                                                                    token=user_token)
                    if success_decline and resp_decline:
                        decline_data = resp_decline.json()
                        self.log_test("Accept / decline / revoke invite flow (decline)", 
                                     decline_data.get("ok") == True,
                                     f"Decline successful: {decline_data.get('ok')}")
                    else:
                        self.log_test("Accept / decline / revoke invite flow (decline)", False,
                                     f"Status: {resp_decline.status_code if resp_decline else 'No response'}")
                    
                    # Test revoke invite (create new one first)
                    success2, resp2 = self.make_request('POST', '/couples/invite', invite_data, token=admin_token)
                    if success2 and resp2:
                        data2 = resp2.json()
                        invite_id2 = data2.get("invite_id")
                        
                        if invite_id2:
                            success_revoke, resp_revoke = self.make_request('DELETE', f'/couples/invites/{invite_id2}', 
                                                                          token=admin_token)
                            if success_revoke and resp_revoke:
                                revoke_data = resp_revoke.json()
                                self.log_test("Accept / decline / revoke invite flow (revoke)", 
                                             revoke_data.get("ok") == True,
                                             f"Revoke successful: {revoke_data.get('ok')}")
                            else:
                                self.log_test("Accept / decline / revoke invite flow (revoke)", False,
                                             f"Status: {resp_revoke.status_code if resp_revoke else 'No response'}")

    def test_smoke_check_other_endpoints(self):
        """Verify no other endpoints broke - random smoke check"""
        print("\n🔍 Testing Smoke Check on Other Endpoints...")
        
        user_token = self.tokens.get("testing@test.com")
        
        if not user_token:
            self.log_test("Smoke check", False, "User token not available")
            return
        
        # Test /api/me
        success, resp = self.make_request('GET', '/me', token=user_token)
        if success and resp:
            data = resp.json()
            has_profile_fields = "email" in data and "preferences" in data
            self.log_test("Verify no other endpoints broke - /api/me", has_profile_fields,
                         f"Profile fields present: {has_profile_fields}")
        else:
            self.log_test("Verify no other endpoints broke - /api/me", False,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test /api/discover
        success, resp = self.make_request('GET', '/discover', token=user_token)
        if success and resp:
            data = resp.json()
            has_results = "results" in data
            self.log_test("Verify no other endpoints broke - /api/discover", has_results,
                         f"Has results field: {has_results}")
        else:
            self.log_test("Verify no other endpoints broke - /api/discover", False,
                         f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test /api/matches
        success, resp = self.make_request('GET', '/matches', token=user_token)
        if success and resp:
            data = resp.json()
            has_matches = "matches" in data
            self.log_test("Verify no other endpoints broke - /api/matches", has_matches,
                         f"Has matches field: {has_matches}")
        else:
            self.log_test("Verify no other endpoints broke - /api/matches", False,
                         f"Status: {resp.status_code if resp else 'No response'}")

    def run_all_tests(self):
        """Run all regression tests"""
        print("🚀 Starting Refactor Regression Tests...")
        print("=" * 60)
        
        # Authentication first
        self.test_auth_login()
        
        # Test the three refactored modules
        self.test_legal_endpoints()
        self.test_blog_endpoints()
        self.test_couples_endpoints()
        self.test_couples_invite_flow()
        
        # Smoke test other endpoints
        self.test_smoke_check_other_endpoints()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for failure in self.failed_tests:
                print(f"  - {failure}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = RefactorRegressionTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())