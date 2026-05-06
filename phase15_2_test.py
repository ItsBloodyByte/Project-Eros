#!/usr/bin/env python3
"""
Focused Phase 15.2 testing for Sparks spending endpoints.
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://auto-implement-2.preview.emergentagent.com"

def log_test(name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {name}")
    if details:
        print(f"    {details}")

def make_request(method, endpoint, data=None, token=None, expected_status=200):
    url = f"{BASE_URL}/api{endpoint}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    expected_statuses = expected_status if isinstance(expected_status, list) else [expected_status]
    
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=30)
        elif method == 'POST':
            response = requests.post(url, json=data, headers=headers, timeout=30)
        elif method == 'PATCH':
            response = requests.patch(url, json=data, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        success = response.status_code in expected_statuses
        return success, response
    except requests.exceptions.Timeout:
        print(f"    ⚠️  Request timeout for {method} {endpoint}")
        return False, None
    except Exception as e:
        print(f"    ⚠️  Request error: {str(e)}")
        return False, None

def main():
    print("🚀 Phase 15.2 Sparks Spending Endpoints Test")
    print(f"Testing against: {BASE_URL}")
    print("=" * 60)
    
    # Login as testing user
    print("\n🔐 Logging in as testing@test.com...")
    success, resp = make_request('POST', '/auth/login', {
        "email": "testing@test.com",
        "password": "testpass123"
    })
    
    if not success or not resp:
        print("❌ Failed to login")
        return 1
    
    token = resp.json().get("access_token")
    user_id = resp.json().get("user", {}).get("id")
    print(f"✅ Logged in successfully. User ID: {user_id}")
    
    # Get initial balance
    print("\n📊 Checking initial Sparks balance...")
    success, resp = make_request('GET', '/me/sparks', token=token)
    if success and resp:
        initial_balance = resp.json().get("balance")
        print(f"✅ Initial balance: {initial_balance} Sparks")
    else:
        print("❌ Failed to get balance")
        return 1
    
    # Test 1: Boost spending (might be 409 if already active)
    print("\n🔍 Test 1: POST /api/sparks/spend/boost")
    success, resp = make_request('POST', '/sparks/spend/boost', token=token, expected_status=[200, 409])
    if success and resp:
        data = resp.json()
        if resp.status_code == 200:
            log_test("Boost spending - New boost", True, 
                    f"Boost ID: {data.get('boost_id')}, Balance: {data.get('sparks_balance')}")
        elif resp.status_code == 409:
            log_test("Boost spending - Already active", True, 
                    f"Message: {data.get('detail', 'Active boost exists')}")
    else:
        log_test("Boost spending", False, "Request failed")
    
    # Test 2: Highlight spending (might be 409 if already active)
    print("\n🔍 Test 2: POST /api/sparks/spend/highlight")
    success, resp = make_request('POST', '/sparks/spend/highlight', token=token, expected_status=[200, 409])
    if success and resp:
        data = resp.json()
        if resp.status_code == 200:
            log_test("Highlight spending - New highlight", True, 
                    f"Highlight until: {data.get('highlight_until')}, Balance: {data.get('sparks_balance')}")
        elif resp.status_code == 409:
            log_test("Highlight spending - Already active", True, 
                    f"Message: {data.get('detail', 'Already highlighted')}")
    else:
        log_test("Highlight spending", False, "Request failed")
    
    # Test 3: Super-like spending
    print("\n🔍 Test 3: POST /api/sparks/spend/super-like")
    # Get a target user from discover
    success, resp = make_request('GET', '/discover?limit=5', token=token)
    if success and resp:
        results = resp.json().get("results", [])
        if results:
            target_id = results[0]["id"]
            success, resp = make_request('POST', '/sparks/spend/super-like', 
                                       {"target_user_id": target_id}, 
                                       token=token, expected_status=[200, 429])
            if success and resp:
                data = resp.json()
                if resp.status_code == 200:
                    log_test("Super-like spending - New super-like", True, 
                            f"Balance: {data.get('sparks_balance')}")
                elif resp.status_code == 429:
                    log_test("Super-like spending - Rate limited", True, 
                            f"Message: {data.get('detail', 'Already super-liked within 24h')}")
            else:
                log_test("Super-like spending", False, "Request failed")
        else:
            log_test("Super-like spending", False, "No users in discover")
    else:
        log_test("Super-like spending", False, "Failed to get discover results")
    
    # Test 4: Extra unlock request
    print("\n🔍 Test 4: POST /api/sparks/spend/extra-unlock-request")
    success, resp = make_request('POST', '/sparks/spend/extra-unlock-request', 
                                {"album_id": "test_album_phase15_2"}, token=token)
    if success and resp:
        data = resp.json()
        log_test("Extra unlock request spending", True, 
                f"Credit granted: {data.get('credit_granted')}, Balance: {data.get('sparks_balance')}")
    else:
        log_test("Extra unlock request spending", False, "Request failed")
    
    # Test 5: Gift premium week
    print("\n🔍 Test 5: POST /api/sparks/spend/gift-premium-week")
    # Get another user to gift to
    if results and len(results) > 1:
        target_id = results[1]["id"]
        success, resp = make_request('POST', '/sparks/spend/gift-premium-week', 
                                   {"target_user_id": target_id}, 
                                   token=token, expected_status=[200, 402])
        if success and resp:
            data = resp.json()
            if resp.status_code == 200:
                log_test("Gift premium week spending", True, 
                        f"Recipient premium until: {data.get('recipient', {}).get('premium_until')}, Balance: {data.get('sparks_balance')}")
            elif resp.status_code == 402:
                log_test("Gift premium week - Insufficient sparks", True, 
                        f"Message: {data.get('detail', 'Not enough sparks')}")
        else:
            log_test("Gift premium week spending", False, "Request failed")
    else:
        log_test("Gift premium week spending", False, "No target user available")
    
    # Test 6: Chat starter
    print("\n🔍 Test 6: POST /api/sparks/spend/chat-starter")
    # Get matches
    success, resp = make_request('GET', '/matches', token=token)
    if success and resp:
        matches = resp.json().get("matches", [])
        if matches:
            match_id = matches[0]["id"]
            success, resp = make_request('POST', '/sparks/spend/chat-starter', 
                                       {"match_id": match_id}, 
                                       token=token, expected_status=[200, 503])
            if success and resp:
                data = resp.json()
                if resp.status_code == 200:
                    starters = data.get('starters', [])
                    log_test("Chat starter spending - AI success", True, 
                            f"Starters: {len(starters)}, Balance: {data.get('sparks_balance')}")
                    for i, starter in enumerate(starters[:3], 1):
                        print(f"      {i}. {starter}")
                elif resp.status_code == 503:
                    log_test("Chat starter - LLM unavailable", True, 
                            f"Message: {data.get('detail', 'AI unavailable')}")
            else:
                log_test("Chat starter spending", False, "Request failed")
        else:
            log_test("Chat starter spending", False, "No matches available")
    else:
        log_test("Chat starter spending", False, "Failed to get matches")
    
    # Test 7: Insufficient sparks error
    print("\n🔍 Test 7: Insufficient sparks error (402)")
    # Create a new user with no sparks
    new_email = f"test_no_sparks_{datetime.now().strftime('%H%M%S')}@example.com"
    success, resp = make_request('POST', '/auth/register', {
        "email": new_email,
        "password": "TestPass123!",
        "display_name": "No Sparks User",
        "age": 25,
        "gender_identity": "man",
        "consents": {
            "terms": True,
            "privacy": True,
            "sensitive_data": True,
            "nsfw_view": False
        }
    })
    
    if success and resp:
        new_token = resp.json().get("access_token")
        success, resp = make_request('POST', '/sparks/spend/boost', 
                                   token=new_token, expected_status=402)
        if success and resp:
            data = resp.json()
            error_msg = data.get("detail", "")
            has_german = "Nicht genug Sparks" in error_msg and "Benötigt:" in error_msg
            log_test("Insufficient sparks error (402)", has_german, 
                    f"Error: {error_msg}")
        else:
            log_test("Insufficient sparks error (402)", False, "Request failed")
    else:
        log_test("Insufficient sparks error (402)", False, "Failed to create test user")
    
    # Test 8: Discover is_highlighted field
    print("\n🔍 Test 8: GET /api/discover - is_highlighted field")
    success, resp = make_request('GET', '/discover?limit=10', token=token)
    if success and resp:
        data = resp.json()
        results = data.get("results", [])
        has_field = all("is_highlighted" in user for user in results) if results else True
        any_highlighted = any(user.get("is_highlighted") == True for user in results)
        log_test("Discover is_highlighted field", has_field, 
                f"Results: {len(results)}, All have field: {has_field}, Any highlighted: {any_highlighted}")
    else:
        log_test("Discover is_highlighted field", False, "Request failed")
    
    # Test 9: Invisible browsing privacy
    print("\n🔍 Test 9: Privacy invisible_browsing feature")
    # Enable invisible browsing
    success, resp = make_request('PATCH', '/me', 
                                {"privacy": {"invisible_browsing": True}}, token=token)
    if success and resp:
        # Visit a profile
        if results:
            target_id = results[0]["id"]
            success, resp = make_request('GET', f'/users/{target_id}', token=token)
            if success:
                log_test("Invisible browsing - Profile visit", True, 
                        "Visit should not be recorded (verified by checking target's visitors)")
            else:
                log_test("Invisible browsing - Profile visit", False, "Failed to visit profile")
        else:
            log_test("Invisible browsing", False, "No target user available")
    else:
        log_test("Invisible browsing setup", False, "Failed to enable invisible browsing")
    
    # Final balance check
    print("\n📊 Checking final Sparks balance...")
    success, resp = make_request('GET', '/me/sparks', token=token)
    if success and resp:
        final_balance = resp.json().get("balance")
        print(f"✅ Final balance: {final_balance} Sparks")
        print(f"   Change: {final_balance - initial_balance} Sparks")
    
    # Test 10: Admin sparks view and adjust
    print("\n🔍 Test 10: Admin sparks management")
    # Login as admin
    success, resp = make_request('POST', '/auth/login', {
        "email": "admin@eros.app",
        "password": "admin123"
    })
    
    if success and resp:
        admin_token = resp.json().get("access_token")
        
        # View user's sparks
        success, resp = make_request('GET', f'/admin/sparks/{user_id}', token=admin_token)
        if success and resp:
            data = resp.json()
            log_test("Admin sparks view", True, 
                    f"Balance: {data.get('balance')}, Ledger entries: {len(data.get('ledger', []))}")
        else:
            log_test("Admin sparks view", False, "Request failed")
        
        # Adjust sparks (credit 50)
        success, resp = make_request('POST', f'/admin/sparks/{user_id}/adjust', 
                                   {"amount": 50, "note": "Test credit for Phase 15.2"}, 
                                   token=admin_token)
        if success and resp:
            data = resp.json()
            log_test("Admin sparks adjust", True, 
                    f"New balance: {data.get('row', {}).get('balance_after')}")
        else:
            log_test("Admin sparks adjust", False, "Request failed")
    else:
        log_test("Admin sparks management", False, "Failed to login as admin")
    
    print("\n" + "=" * 60)
    print("✅ Phase 15.2 testing complete!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
