#!/usr/bin/env python3
"""
Comprehensive backend API testing for German Inclusive Modern Dating Platform.
Tests all endpoints including auth, profile management, AI moderation, discovery,
matching, chat, albums, reports, admin functions, and GDPR compliance.
"""

import requests
import json
import base64
import sys
from datetime import datetime, timezone
from typing import Dict, Optional, List

class DatingPlatformTester:
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
            "alice@eros.app": {"password": "Passw0rd!2025", "role": "user"},
            "werner@eros.app": {"password": "Passw0rd!2025", "role": "user"},
            "bob@eros.app": {"password": "Passw0rd!2025", "role": "user"},
            "sam@eros.app": {"password": "Passw0rd!2025", "role": "user"},
            "review@eros.app": {"password": "Passw0rd!2025", "role": "content_reviewer"},
            "support@eros.app": {"password": "Passw0rd!2025", "role": "support"}
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
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code == expected_status
            return success, response
        except Exception as e:
            print(f"Request error: {str(e)}")
            return False, None

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        success, resp = self.make_request('GET', '/')
        if success and resp:
            data = resp.json()
            self.log_test("GET /api/", success and data.get("status") == "ok", 
                         f"Response: {data}")
        else:
            self.log_test("GET /api/", False, "Failed to get response")
        
        # Test health endpoint
        success, resp = self.make_request('GET', '/health')
        if success and resp:
            data = resp.json()
            self.log_test("GET /api/health", success and data.get("status") == "ok",
                         f"Response: {data}")
        else:
            self.log_test("GET /api/health", False, "Failed to get response")

    def test_auth_register(self):
        """Test registration with consent validation"""
        print("\n🔍 Testing Registration...")
        
        # Test invalid consent (missing required consents)
        invalid_data = {
            "email": "test_invalid@example.com",
            "password": "TestPass123!",
            "display_name": "Test User",
            "age": 25,
            "consents": {
                "terms": False,  # Missing required consent
                "privacy": True,
                "sensitive_data": True,
                "nsfw_view": False
            }
        }
        
        success, resp = self.make_request('POST', '/auth/register', invalid_data, expected_status=400)
        self.log_test("POST /auth/register - Invalid consent rejection", success,
                     f"Status: {resp.status_code if resp else 'No response'}")
        
        # Test valid registration
        valid_data = {
            "email": f"test_valid_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "TestPass123!",
            "display_name": "Valid Test User",
            "age": 28,
            "consents": {
                "terms": True,
                "privacy": True,
                "sensitive_data": True,
                "nsfw_view": True
            }
        }
        
        success, resp = self.make_request('POST', '/auth/register', valid_data, expected_status=200)
        if success and resp:
            data = resp.json()
            has_token = "access_token" in data
            has_user = "user" in data
            self.log_test("POST /auth/register - Valid registration", 
                         has_token and has_user,
                         f"Token: {'✓' if has_token else '✗'}, User: {'✓' if has_user else '✗'}")
        else:
            self.log_test("POST /auth/register - Valid registration", False, "Failed to register")

    def test_auth_login(self):
        """Test login with seeded credentials"""
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

    def test_profile_endpoints(self):
        """Test profile management"""
        print("\n🔍 Testing Profile Management...")
        
        alice_token = self.tokens.get("alice@eros.app")
        if not alice_token:
            self.log_test("Profile tests", False, "Alice token not available")
            return
        
        # Test GET /me
        success, resp = self.make_request('GET', '/me', token=alice_token)
        if success and resp:
            data = resp.json()
            has_profile = "email" in data and "preferences" in data and "privacy" in data
            self.log_test("GET /api/me", has_profile, 
                         f"Profile fields: {list(data.keys())}")
        else:
            self.log_test("GET /api/me", False, "Failed to get profile")
        
        # Test PATCH /me - Update profile
        update_data = {
            "display_name": "Alice Updated",
            "bio": "Updated bio for testing",
            "gender_identity": "woman",
            "pronouns": "she/her",
            "orientation": "bisexual",
            "relationship_types": ["serious", "casual"],
            "preferences": {
                "seeking_genders": ["man", "woman"],
                "age_min": 30,
                "age_max": 40,
                "radius_km": 25
            },
            "location": {
                "type": "Point",
                "coordinates": [13.4050, 52.5200]  # Berlin coordinates
            }
        }
        
        success, resp = self.make_request('PATCH', '/me', update_data, token=alice_token)
        if success and resp:
            data = resp.json()
            updated_correctly = (
                data.get("display_name") == "Alice Updated" and
                data.get("gender_identity") == "woman" and
                data.get("pronouns") == "she/her"
            )
            self.log_test("PATCH /api/me", updated_correctly,
                         f"Updated fields: {data.get('display_name')}, {data.get('gender_identity')}")
        else:
            self.log_test("PATCH /api/me", False, "Failed to update profile")

    def get_test_image_data_url(self):
        """Generate a simple test image as base64 data URL"""
        # Create a simple 100x100 red square PNG
        import io
        try:
            from PIL import Image
            img = Image.new('RGB', (100, 100), color='red')
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_data = buffer.getvalue()
            b64_data = base64.b64encode(img_data).decode()
            return f"data:image/png;base64,{b64_data}"
        except ImportError:
            # Fallback: minimal PNG header + red pixel data
            # This is a very basic 1x1 red PNG
            png_data = base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
            )
            b64_data = base64.b64encode(png_data).decode()
            return f"data:image/png;base64,{b64_data}"

    def test_photo_upload(self):
        """Test photo upload with AI moderation"""
        print("\n🔍 Testing Photo Upload & AI Moderation...")
        
        alice_token = self.tokens.get("alice@eros.app")
        if not alice_token:
            self.log_test("Photo upload tests", False, "Alice token not available")
            return
        
        # Test photo upload
        photo_data = {
            "data_url": self.get_test_image_data_url(),
            "is_primary": True
        }
        
        success, resp = self.make_request('POST', '/me/photos', photo_data, token=alice_token)
        if success and resp:
            data = resp.json()
            has_moderation = all(key in data for key in ["nsfw_score", "has_face", "category", "labels"])
            self.log_test("POST /api/me/photos", has_moderation,
                         f"AI moderation: nsfw_score={data.get('nsfw_score')}, has_face={data.get('has_face')}")
        else:
            self.log_test("POST /api/me/photos", False, 
                         f"Status: {resp.status_code if resp else 'No response'}")

    def test_discovery_bidirectional_filter(self):
        """Test discovery with bidirectional filtering (Alice-Werner principle)"""
        print("\n🔍 Testing Discovery & Bidirectional Filtering...")
        
        alice_token = self.tokens.get("alice@eros.app")
        werner_token = self.tokens.get("werner@eros.app")
        
        if not alice_token:
            self.log_test("Discovery tests", False, "Alice token not available")
            return
        
        # First, ensure Alice and Werner have compatible preferences
        # Alice seeks men+women 30-40, Werner should seek women 25-32
        werner_update = {
            "gender_identity": "man",
            "age": 35,
            "preferences": {
                "seeking_genders": ["woman"],
                "age_min": 25,
                "age_max": 32
            }
        }
        
        if werner_token:
            self.make_request('PATCH', '/me', werner_update, token=werner_token)
        
        # Test Alice's discovery
        success, resp = self.make_request('GET', '/discover', token=alice_token)
        if success and resp:
            data = resp.json()
            results = data.get("results", [])
            
            # Check if Werner appears (bidirectional match)
            werner_found = any(user.get("id") == self.users.get("werner@eros.app", {}).get("id") 
                             for user in results)
            
            # Check distance is rounded (integer)
            distances_rounded = all(
                isinstance(user.get("distance_km"), int) or user.get("distance_km") is None
                for user in results
            )
            
            self.log_test("GET /api/discover - Bidirectional filter", werner_found,
                         f"Werner found: {werner_found}, Results count: {len(results)}")
            self.log_test("GET /api/discover - Rounded distances", distances_rounded,
                         f"Distance types: {[type(u.get('distance_km')) for u in results[:3]]}")
        else:
            self.log_test("GET /api/discover", False, "Failed to get discovery results")

    def test_likes_and_matching(self):
        """Test likes and mutual matching"""
        print("\n🔍 Testing Likes & Mutual Matching...")
        
        alice_token = self.tokens.get("alice@eros.app")
        werner_token = self.tokens.get("werner@eros.app")
        
        if not alice_token or not werner_token:
            self.log_test("Likes tests", False, "Missing tokens")
            return
        
        alice_id = self.users.get("alice@eros.app", {}).get("id")
        werner_id = self.users.get("werner@eros.app", {}).get("id")
        
        if not alice_id or not werner_id:
            self.log_test("Likes tests", False, "Missing user IDs")
            return
        
        # Alice likes Werner
        like_data = {"target_user_id": werner_id}
        success, resp = self.make_request('POST', '/likes', like_data, token=alice_token)
        if success and resp:
            data = resp.json()
            alice_liked = data.get("liked", False)
            self.log_test("POST /api/likes - Alice likes Werner", alice_liked,
                         f"Response: {data}")
        else:
            self.log_test("POST /api/likes - Alice likes Werner", False, "Failed to create like")
        
        # Werner likes Alice (should create match)
        like_data = {"target_user_id": alice_id}
        success, resp = self.make_request('POST', '/likes', like_data, token=werner_token)
        if success and resp:
            data = resp.json()
            matched = data.get("matched", False)
            match_id = data.get("match_id")
            self.log_test("POST /api/likes - Werner likes Alice (mutual)", matched,
                         f"Matched: {matched}, Match ID: {match_id}")
            
            # Store match_id for later tests
            if match_id:
                self.match_id = match_id
        else:
            self.log_test("POST /api/likes - Werner likes Alice", False, "Failed to create like")

    def test_matches_and_messages(self):
        """Test matches listing and messaging"""
        print("\n🔍 Testing Matches & Messaging...")
        
        alice_token = self.tokens.get("alice@eros.app")
        werner_token = self.tokens.get("werner@eros.app")
        
        if not alice_token or not werner_token:
            self.log_test("Matches tests", False, "Missing tokens")
            return
        
        # Test GET /matches
        success, resp = self.make_request('GET', '/matches', token=alice_token)
        if success and resp:
            data = resp.json()
            matches = data.get("matches", [])
            has_unread_count = all("unread_count" in match for match in matches)
            self.log_test("GET /api/matches", len(matches) > 0 and has_unread_count,
                         f"Matches count: {len(matches)}, Has unread_count: {has_unread_count}")
            
            if matches:
                match_id = matches[0]["id"]
                self.match_id = match_id
        else:
            self.log_test("GET /api/matches", False, "Failed to get matches")
        
        # Test messaging (requires match_id)
        if hasattr(self, 'match_id'):
            # Test GET messages (initially empty)
            success, resp = self.make_request('GET', f'/matches/{self.match_id}/messages', token=alice_token)
            if success and resp:
                data = resp.json()
                messages = data.get("messages", [])
                self.log_test("GET /api/matches/:id/messages", True,
                             f"Initial messages count: {len(messages)}")
            else:
                self.log_test("GET /api/matches/:id/messages", False, "Failed to get messages")
            
            # Test POST message
            message_data = {
                "match_id": self.match_id,
                "text": "Hello from Alice! Testing the chat system."
            }
            success, resp = self.make_request('POST', '/messages', message_data, token=alice_token)
            if success and resp:
                data = resp.json()
                has_message_fields = all(key in data for key in ["id", "text", "sender_id", "read_by"])
                self.log_test("POST /api/messages", has_message_fields,
                             f"Message created: {data.get('text', '')[:30]}...")
            else:
                self.log_test("POST /api/messages", False, "Failed to send message")
            
            # Test message with media (AI moderation)
            media_message_data = {
                "match_id": self.match_id,
                "text": "Sending a test image",
                "media_data_url": self.get_test_image_data_url()
            }
            success, resp = self.make_request('POST', '/messages', media_message_data, token=alice_token)
            if success and resp:
                data = resp.json()
                has_nsfw_score = "nsfw_score" in data
                self.log_test("POST /api/messages - Media with AI moderation", has_nsfw_score,
                             f"NSFW score: {data.get('nsfw_score')}")
            else:
                self.log_test("POST /api/messages - Media", False, "Failed to send media message")
        
        # Test chat restrictions (non-match)
        bob_token = self.tokens.get("bob@eros.app")
        if bob_token and hasattr(self, 'match_id'):
            # Bob tries to send message to Alice-Werner match (should fail)
            restricted_message = {
                "match_id": self.match_id,
                "text": "This should fail - Bob is not in this match"
            }
            success, resp = self.make_request('POST', '/messages', restricted_message, 
                                            token=bob_token, expected_status=403)
            self.log_test("POST /api/messages - Chat restriction", success,
                         "Bob correctly blocked from Alice-Werner chat")

    def test_albums(self):
        """Test album creation and sharing"""
        print("\n🔍 Testing Albums...")
        
        alice_token = self.tokens.get("alice@eros.app")
        werner_token = self.tokens.get("werner@eros.app")
        
        if not alice_token:
            self.log_test("Albums tests", False, "Alice token not available")
            return
        
        # Create album
        album_data = {
            "title": "Test Album",
            "description": "Testing album functionality",
            "is_nsfw": False
        }
        success, resp = self.make_request('POST', '/albums', album_data, token=alice_token)
        if success and resp:
            album = resp.json()
            album_id = album.get("id")
            self.log_test("POST /api/albums", True, f"Album created: {album.get('title')}")
            
            # Add photo to album
            if album_id:
                photo_data = {
                    "data_url": self.get_test_image_data_url(),
                    "is_primary": False
                }
                success, resp = self.make_request('POST', f'/albums/{album_id}/photos', 
                                                photo_data, token=alice_token)
                if success and resp:
                    photo = resp.json()
                    has_ai_moderation = "nsfw_score" in photo
                    self.log_test("POST /api/albums/:id/photos", has_ai_moderation,
                                 f"Photo added with AI moderation: {photo.get('nsfw_score')}")
                else:
                    self.log_test("POST /api/albums/:id/photos", False, "Failed to add photo")
                
                # Test sharing with non-match (should fail)
                bob_id = self.users.get("bob@eros.app", {}).get("id")
                if bob_id:
                    share_data = {
                        "album_id": album_id,
                        "user_id": bob_id
                    }
                    success, resp = self.make_request('POST', '/albums/share', share_data, 
                                                    token=alice_token, expected_status=403)
                    self.log_test("POST /api/albums/share - Non-match restriction", success,
                                 "Correctly blocked sharing with non-match")
                
                # Test sharing with match (should succeed)
                werner_id = self.users.get("werner@eros.app", {}).get("id")
                if werner_id:
                    share_data = {
                        "album_id": album_id,
                        "user_id": werner_id
                    }
                    success, resp = self.make_request('POST', '/albums/share', share_data, token=alice_token)
                    self.log_test("POST /api/albums/share - Match sharing", success,
                                 "Successfully shared with match")
        else:
            self.log_test("POST /api/albums", False, "Failed to create album")

    def test_reports(self):
        """Test reporting system"""
        print("\n🔍 Testing Reports...")
        
        alice_token = self.tokens.get("alice@eros.app")
        if not alice_token:
            self.log_test("Reports tests", False, "Alice token not available")
            return
        
        # Create a report
        werner_id = self.users.get("werner@eros.app", {}).get("id")
        if werner_id:
            report_data = {
                "target_type": "user",
                "target_id": werner_id,
                "reason": "spam",
                "detail": "Testing report functionality"
            }
            success, resp = self.make_request('POST', '/reports', report_data, token=alice_token)
            if success and resp:
                report = resp.json()
                has_report_fields = all(key in report for key in ["id", "target_type", "reason", "status"])
                self.log_test("POST /api/reports", has_report_fields,
                             f"Report created: {report.get('reason')}")
            else:
                self.log_test("POST /api/reports", False, "Failed to create report")

    def test_admin_functions(self):
        """Test admin panel functions"""
        print("\n🔍 Testing Admin Functions...")
        
        admin_token = self.tokens.get("admin@eros.app")
        alice_token = self.tokens.get("alice@eros.app")
        
        if not admin_token:
            self.log_test("Admin tests", False, "Admin token not available")
            return
        
        # Test admin reports access
        success, resp = self.make_request('GET', '/admin/reports', token=admin_token)
        if success and resp:
            data = resp.json()
            reports = data.get("reports", [])
            self.log_test("GET /api/admin/reports", True, f"Reports count: {len(reports)}")
        else:
            self.log_test("GET /api/admin/reports", False, "Failed to get admin reports")
        
        # Test admin users access
        success, resp = self.make_request('GET', '/admin/users', token=admin_token)
        if success and resp:
            data = resp.json()
            users = data.get("users", [])
            self.log_test("GET /api/admin/users", True, f"Users count: {len(users)}")
        else:
            self.log_test("GET /api/admin/users", False, "Failed to get admin users")
        
        # Test admin audit log
        success, resp = self.make_request('GET', '/admin/audit', token=admin_token)
        if success and resp:
            data = resp.json()
            events = data.get("events", [])
            self.log_test("GET /api/admin/audit", True, f"Audit events count: {len(events)}")
        else:
            self.log_test("GET /api/admin/audit", False, "Failed to get audit log")
        
        # Test admin moderation photos
        success, resp = self.make_request('GET', '/admin/moderation/photos', token=admin_token)
        if success and resp:
            data = resp.json()
            photos = data.get("photos", [])
            self.log_test("GET /api/admin/moderation/photos", True, f"Moderation photos count: {len(photos)}")
        else:
            self.log_test("GET /api/admin/moderation/photos", False, "Failed to get moderation photos")
        
        # Test normal user access to admin endpoints (should fail)
        if alice_token:
            success, resp = self.make_request('GET', '/admin/reports', token=alice_token, expected_status=403)
            self.log_test("Admin access restriction", success, "Normal user correctly blocked from admin endpoints")

    def test_gdpr_functions(self):
        """Test GDPR export and delete"""
        print("\n🔍 Testing GDPR Functions...")
        
        alice_token = self.tokens.get("alice@eros.app")
        if not alice_token:
            self.log_test("GDPR tests", False, "Alice token not available")
            return
        
        # Test GDPR export
        success, resp = self.make_request('GET', '/gdpr/export', token=alice_token)
        if success and resp:
            data = resp.json()
            has_gdpr_data = all(key in data for key in ["profile", "likes", "matches", "messages", "albums"])
            self.log_test("GET /api/gdpr/export", has_gdpr_data,
                         f"GDPR export sections: {list(data.keys())}")
        else:
            self.log_test("GET /api/gdpr/export", False, "Failed to export GDPR data")
        
        # Note: We don't test DELETE /gdpr/account as it would delete the seeded user
        # But we can verify the endpoint exists by checking if it returns proper error for missing auth
        success, resp = self.make_request('DELETE', '/gdpr/account', expected_status=401)
        self.log_test("DELETE /api/gdpr/account endpoint exists", success, 
                     "GDPR delete endpoint properly requires authentication")

    def test_privacy_features(self):
        """Test privacy features like hidden mode"""
        print("\n🔍 Testing Privacy Features...")
        
        alice_token = self.tokens.get("alice@eros.app")
        bob_token = self.tokens.get("bob@eros.app")
        
        if not alice_token or not bob_token:
            self.log_test("Privacy tests", False, "Missing tokens")
            return
        
        # Enable hidden mode for Alice
        privacy_update = {
            "privacy": {
                "hidden_mode": True,
                "read_receipts": False
            }
        }
        success, resp = self.make_request('PATCH', '/me', privacy_update, token=alice_token)
        if success:
            self.log_test("PATCH /api/me - Privacy settings", True, "Hidden mode enabled")
            
            # Bob should not see Alice in discovery now
            success, resp = self.make_request('GET', '/discover', token=bob_token)
            if success and resp:
                data = resp.json()
                results = data.get("results", [])
                alice_id = self.users.get("alice@eros.app", {}).get("id")
                alice_hidden = not any(user.get("id") == alice_id for user in results)
                self.log_test("Hidden mode functionality", alice_hidden,
                             f"Alice hidden from Bob's discovery: {alice_hidden}")
            else:
                self.log_test("Hidden mode test", False, "Failed to test discovery")
        else:
            self.log_test("Privacy settings update", False, "Failed to update privacy")

    def test_phase3_email_verification(self):
        """Test Phase 3: Email verification"""
        print("\n🔍 Testing Phase 3: Email Verification...")
        
        alice_token = self.tokens.get("alice@eros.app")
        if not alice_token:
            self.log_test("Email verification tests", False, "Alice token not available")
            return
        
        # Test send email code (requires auth)
        success, resp = self.make_request('POST', '/auth/email/send-code', token=alice_token)
        if success and resp:
            data = resp.json()
            has_dev_code = "dev_code" in data
            self.log_test("POST /api/auth/email/send-code", has_dev_code,
                         f"Dev code returned: {data.get('dev_code', 'None')}")
            
            # Test verify email with the dev code
            if has_dev_code:
                verify_data = {"code": data["dev_code"]}
                success, resp = self.make_request('POST', '/auth/email/verify', verify_data, token=alice_token)
                if success and resp:
                    # Check if email_verified is now true via /me
                    success_me, resp_me = self.make_request('GET', '/me', token=alice_token)
                    if success_me and resp_me:
                        me_data = resp_me.json()
                        email_verified = me_data.get("email_verified", False)
                        self.log_test("POST /api/auth/email/verify", email_verified,
                                     f"Email verified status: {email_verified}")
                    else:
                        self.log_test("POST /api/auth/email/verify", False, "Failed to check verification status")
                else:
                    self.log_test("POST /api/auth/email/verify", False, "Failed to verify email")
        else:
            self.log_test("POST /api/auth/email/send-code", False, "Failed to send code")

    def test_phase3_mfa(self):
        """Test Phase 3: MFA (TOTP)"""
        print("\n🔍 Testing Phase 3: MFA (TOTP)...")
        
        alice_token = self.tokens.get("alice@eros.app")
        if not alice_token:
            self.log_test("MFA tests", False, "Alice token not available")
            return
        
        # Test MFA setup
        success, resp = self.make_request('POST', '/auth/mfa/setup', token=alice_token)
        if success and resp:
            data = resp.json()
            has_secret = "secret" in data and "otpauth_url" in data
            self.log_test("POST /api/auth/mfa/setup", has_secret,
                         f"Secret length: {len(data.get('secret', ''))}")
            
            if has_secret:
                # For testing, we'll use a mock TOTP code (this would normally be generated by an authenticator app)
                # Since we can't generate real TOTP codes in this test, we'll test the enable endpoint with an invalid code
                # to verify it properly rejects invalid codes
                mock_code = "123456"
                enable_data = {"code": mock_code}
                success, resp = self.make_request('POST', '/auth/mfa/enable', enable_data, 
                                                token=alice_token, expected_status=400)
                self.log_test("POST /api/auth/mfa/enable - Invalid code rejection", success,
                             "Correctly rejected invalid TOTP code")
        else:
            self.log_test("POST /api/auth/mfa/setup", False, "Failed to setup MFA")
        
        # Test login-mfa endpoint for account without MFA
        login_data = {
            "email": "alice@eros.app",
            "password": "Passw0rd!2025"
        }
        success, resp = self.make_request('POST', '/auth/login-mfa', login_data)
        if success and resp:
            data = resp.json()
            has_token = "access_token" in data
            self.log_test("POST /api/auth/login-mfa - No MFA account", has_token,
                         "Login works without MFA code for non-MFA account")
        else:
            self.log_test("POST /api/auth/login-mfa - No MFA account", False, "Failed to login without MFA")

    def test_phase3_videos(self):
        """Test Phase 3: Video clips"""
        print("\n🔍 Testing Phase 3: Video Clips...")
        
        alice_token = self.tokens.get("alice@eros.app")
        werner_token = self.tokens.get("werner@eros.app")
        
        if not alice_token:
            self.log_test("Video tests", False, "Alice token not available")
            return
        
        # Create a tiny synthetic MP4 data URL for testing
        # This is a minimal MP4 header - in real usage this would be a proper video
        tiny_mp4_b64 = "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE="  # Minimal MP4 header
        video_data_url = f"data:video/mp4;base64,{tiny_mp4_b64}"
        
        # Test video upload
        video_data = {
            "data_url": video_data_url,
            "caption": "Test video upload"
        }
        success, resp = self.make_request('POST', '/me/videos', video_data, token=alice_token)
        if success and resp:
            data = resp.json()
            has_video_fields = all(key in data for key in ["id", "data", "moderation_status"])
            pending_status = data.get("moderation_status") == "pending"
            self.log_test("POST /api/me/videos", has_video_fields and pending_status,
                         f"Video uploaded with status: {data.get('moderation_status')}")
            
            video_id = data.get("id")
            alice_id = self.users.get("alice@eros.app", {}).get("id")
            
            # Test get own videos (should return pending videos)
            if alice_id:
                success, resp = self.make_request('GET', f'/users/{alice_id}/videos', token=alice_token)
                if success and resp:
                    data = resp.json()
                    videos = data.get("videos", [])
                    has_pending = any(v.get("moderation_status") == "pending" for v in videos)
                    self.log_test("GET /api/users/{me}/videos - Own videos", has_pending,
                                 f"Own pending videos visible: {len(videos)} videos")
                else:
                    self.log_test("GET /api/users/{me}/videos", False, "Failed to get own videos")
            
            # Test get videos as different user (should NOT return pending videos)
            if werner_token and alice_id:
                success, resp = self.make_request('GET', f'/users/{alice_id}/videos', token=werner_token)
                if success and resp:
                    data = resp.json()
                    videos = data.get("videos", [])
                    no_pending = not any(v.get("moderation_status") == "pending" for v in videos)
                    self.log_test("GET /api/users/{other}/videos - Other user", no_pending,
                                 f"Pending videos hidden from others: {len(videos)} videos visible")
                else:
                    self.log_test("GET /api/users/{other}/videos", False, "Failed to get other user videos")
            
            # Test delete video
            if video_id:
                success, resp = self.make_request('DELETE', f'/me/videos/{video_id}', token=alice_token)
                self.log_test("DELETE /api/me/videos/{id}", success, "Video deletion")
        else:
            self.log_test("POST /api/me/videos", False, "Failed to upload video")

    def test_phase3_premium_features(self):
        """Test Phase 3: Premium features"""
        print("\n🔍 Testing Phase 3: Premium Features...")
        
        alice_token = self.tokens.get("alice@eros.app")
        werner_token = self.tokens.get("werner@eros.app")
        
        if not alice_token or not werner_token:
            self.log_test("Premium tests", False, "Missing tokens")
            return
        
        # Test premium upgrade
        upgrade_data = {"duration_days": 30}
        success, resp = self.make_request('POST', '/premium/upgrade', upgrade_data, token=alice_token)
        if success and resp:
            data = resp.json()
            has_premium_until = "premium_until" in data
            self.log_test("POST /api/premium/upgrade", has_premium_until,
                         f"Premium until: {data.get('premium_until', 'None')}")
        else:
            self.log_test("POST /api/premium/upgrade", False, "Failed to upgrade to premium")
        
        # Test premium status
        success, resp = self.make_request('GET', '/premium/status', token=alice_token)
        if success and resp:
            data = resp.json()
            is_premium = data.get("premium", False)
            self.log_test("GET /api/premium/status", is_premium,
                         f"Premium status: {is_premium}")
        else:
            self.log_test("GET /api/premium/status", False, "Failed to get premium status")
        
        # Test likes received (premium feature) - should work for premium user
        success, resp = self.make_request('GET', '/likes/received', token=alice_token)
        if success and resp:
            data = resp.json()
            has_received = "received" in data
            self.log_test("GET /api/likes/received - Premium user", has_received,
                         f"Received likes count: {len(data.get('received', []))}")
        else:
            self.log_test("GET /api/likes/received - Premium user", False, "Failed to get received likes")
        
        # Test likes received for free user (should return 402)
        success, resp = self.make_request('GET', '/likes/received', token=werner_token, expected_status=402)
        self.log_test("GET /api/likes/received - Free user", success,
                     "Correctly blocked free user from premium feature")
        
        # Test boost (premium required)
        boost_data = {"duration_minutes": 30}
        success, resp = self.make_request('POST', '/me/boost', boost_data, token=alice_token)
        if success and resp:
            data = resp.json()
            has_boost_until = "boost_until" in data
            self.log_test("POST /api/me/boost - Premium user", has_boost_until,
                         f"Boost until: {data.get('boost_until', 'None')}")
        else:
            self.log_test("POST /api/me/boost - Premium user", False, "Failed to activate boost")
        
        # Test boost for free user (should return 402)
        success, resp = self.make_request('POST', '/me/boost', boost_data, token=werner_token, expected_status=402)
        self.log_test("POST /api/me/boost - Free user", success,
                     "Correctly blocked free user from boost")
        
        # Test message first (premium feature)
        werner_id = self.users.get("werner@eros.app", {}).get("id")
        if werner_id:
            message_first_data = {
                "target_user_id": werner_id,
                "text": "Hello! This is a premium first message."
            }
            success, resp = self.make_request('POST', '/messages/first', message_first_data, token=alice_token)
            if success and resp:
                data = resp.json()
                has_match_id = "match_id" in data and "message" in data
                self.log_test("POST /api/messages/first - Premium user", has_match_id,
                             f"Match created: {data.get('match_id', 'None')}")
            else:
                self.log_test("POST /api/messages/first - Premium user", False, "Failed to send first message")
            
            # Test message first for free user (should return 402)
            success, resp = self.make_request('POST', '/messages/first', message_first_data, 
                                            token=werner_token, expected_status=402)
            self.log_test("POST /api/messages/first - Free user", success,
                         "Correctly blocked free user from message first")

    def test_phase3_events(self):
        """Test Phase 3: Events"""
        print("\n🔍 Testing Phase 3: Events...")
        
        alice_token = self.tokens.get("alice@eros.app")
        werner_token = self.tokens.get("werner@eros.app")
        
        if not alice_token:
            self.log_test("Events tests", False, "Alice token not available")
            return
        
        # Test create event
        from datetime import datetime, timezone, timedelta
        future_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        
        event_data = {
            "title": "Test Event",
            "description": "Testing event functionality",
            "starts_at": future_date,
            "location_name": "Test Venue",
            "is_nsfw": False
        }
        success, resp = self.make_request('POST', '/events', event_data, token=alice_token)
        if success and resp:
            event = resp.json()
            event_id = event.get("id")
            has_event_fields = all(key in event for key in ["id", "title", "starts_at", "owner_id"])
            self.log_test("POST /api/events", has_event_fields,
                         f"Event created: {event.get('title')}")
        else:
            self.log_test("POST /api/events", False, "Failed to create event")
            return
        
        # Test list events
        success, resp = self.make_request('GET', '/events', token=alice_token)
        if success and resp:
            data = resp.json()
            events = data.get("events", [])
            has_counts = all("going_count" in ev and "interested_count" in ev for ev in events)
            self.log_test("GET /api/events", len(events) > 0 and has_counts,
                         f"Events count: {len(events)}, Has RSVP counts: {has_counts}")
        else:
            self.log_test("GET /api/events", False, "Failed to list events")
        
        # Test get specific event
        if event_id:
            success, resp = self.make_request('GET', f'/events/{event_id}', token=alice_token)
            if success and resp:
                event = resp.json()
                has_details = "my_rsvp" in event and "rsvps" in event
                self.log_test("GET /api/events/{id}", has_details,
                             f"Event details with RSVP info: {event.get('my_rsvp')}")
            else:
                self.log_test("GET /api/events/{id}", False, "Failed to get event details")
            
            # Test RSVP to event
            rsvp_data = {"status": "going"}
            success, resp = self.make_request('POST', f'/events/{event_id}/rsvp', rsvp_data, token=alice_token)
            if success and resp:
                self.log_test("POST /api/events/{id}/rsvp", True, "RSVP successful")
                
                # Verify RSVP was recorded
                success, resp = self.make_request('GET', f'/events/{event_id}', token=alice_token)
                if success and resp:
                    event = resp.json()
                    my_rsvp = event.get("my_rsvp")
                    going_count = event.get("going_count", 0)
                    self.log_test("RSVP verification", my_rsvp == "going" and going_count > 0,
                                 f"My RSVP: {my_rsvp}, Going count: {going_count}")
            else:
                self.log_test("POST /api/events/{id}/rsvp", False, "Failed to RSVP")
            
            # Test delete event as non-owner (should fail)
            if werner_token:
                success, resp = self.make_request('DELETE', f'/events/{event_id}', 
                                                token=werner_token, expected_status=403)
                self.log_test("DELETE /api/events/{id} - Non-owner", success,
                             "Correctly blocked non-owner from deleting event")
            
            # Test delete event as owner
            success, resp = self.make_request('DELETE', f'/events/{event_id}', token=alice_token)
            self.log_test("DELETE /api/events/{id} - Owner", success, "Owner can delete event")

    def test_phase3_admin_roles(self):
        """Test Phase 3: Extended admin roles"""
        print("\n🔍 Testing Phase 3: Extended Admin Roles...")
        
        admin_token = self.tokens.get("admin@eros.app")
        review_token = self.tokens.get("review@eros.app")
        support_token = self.tokens.get("support@eros.app")
        
        if not admin_token:
            self.log_test("Admin roles tests", False, "Admin token not available")
            return
        
        # Test admin role setting
        alice_id = self.users.get("alice@eros.app", {}).get("id")
        if alice_id:
            role_data = {
                "user_id": alice_id,
                "role": "support"
            }
            success, resp = self.make_request('POST', '/admin/role', role_data, token=admin_token)
            self.log_test("POST /api/admin/role", success, "Admin can set user roles")
        
        # Test content_reviewer access to moderation photos
        if review_token:
            success, resp = self.make_request('GET', '/admin/moderation/photos', token=review_token)
            if success and resp:
                data = resp.json()
                photos = data.get("photos", [])
                self.log_test("GET /api/admin/moderation/photos - Content reviewer", True,
                             f"Content reviewer can access moderation: {len(photos)} photos")
            else:
                self.log_test("GET /api/admin/moderation/photos - Content reviewer", False,
                             "Content reviewer cannot access moderation")
            
            # Test content_reviewer cannot access ban endpoint
            ban_data = {
                "user_id": alice_id,
                "reason": "Test ban"
            }
            success, resp = self.make_request('POST', '/admin/ban', ban_data, 
                                            token=review_token, expected_status=403)
            self.log_test("POST /api/admin/ban - Content reviewer", success,
                         "Content reviewer correctly blocked from ban endpoint")
        
        # Test admin can access ban endpoint
        if alice_id:
            ban_data = {
                "user_id": alice_id,
                "reason": "Test ban by admin"
            }
            success, resp = self.make_request('POST', '/admin/ban', ban_data, token=admin_token)
            self.log_test("POST /api/admin/ban - Admin", success, "Admin can access ban endpoint")
            
            # Unban for cleanup
            if success:
                success, resp = self.make_request('POST', f'/admin/unban/{alice_id}', token=admin_token)

    def run_all_tests(self):
        """Run comprehensive test suite including Phase 3"""
        print("🚀 Starting Comprehensive Dating Platform API Tests (Phase 3)")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        try:
            # Phase 1 & 2 tests (existing)
            self.test_health_endpoints()
            self.test_auth_register()
            self.test_auth_login()
            self.test_profile_endpoints()
            self.test_photo_upload()
            self.test_discovery_bidirectional_filter()
            self.test_likes_and_matching()
            self.test_matches_and_messages()
            self.test_albums()
            self.test_reports()
            self.test_admin_functions()
            self.test_gdpr_functions()
            self.test_privacy_features()
            
            # Phase 3 tests (new)
            self.test_phase3_email_verification()
            self.test_phase3_mfa()
            self.test_phase3_videos()
            self.test_phase3_premium_features()
            self.test_phase3_events()
            self.test_phase3_admin_roles()
            
        except Exception as e:
            print(f"\n❌ Test suite error: {str(e)}")
            self.failed_tests.append(f"Test suite error: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 TEST SUMMARY")
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
    tester = DatingPlatformTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())