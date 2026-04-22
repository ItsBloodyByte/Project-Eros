#!/usr/bin/env python3
"""Debug PayPal checkout test"""

import requests
import json

def test_paypal_checkout():
    base_url = "https://auto-implement-2.preview.emergentagent.com"
    
    # Login as admin
    login_data = {"email": "admin@eros.app", "password": "Passw0rd!2025"}
    resp = requests.post(f"{base_url}/api/auth/login", json=login_data, timeout=30)
    admin_token = resp.json()["access_token"]
    print(f"Admin login: {resp.status_code}")
    
    # Login as alice
    login_data = {"email": "alice@eros.app", "password": "Passw0rd!2025"}
    resp = requests.post(f"{base_url}/api/auth/login", json=login_data, timeout=30)
    alice_token = resp.json()["access_token"]
    print(f"Alice login: {resp.status_code}")
    
    # Set PayPal config
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
    headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {admin_token}'}
    resp = requests.post(f"{base_url}/api/admin/payment-config", json=paypal_config, headers=headers, timeout=30)
    print(f"PayPal config: {resp.status_code}")
    
    # Test checkout
    checkout_data = {
        "package_id": "premium_30",
        "origin_url": "http://x"
    }
    headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {alice_token}'}
    
    print("Making checkout request...")
    try:
        resp = requests.post(f"{base_url}/api/payments/checkout", json=checkout_data, headers=headers, timeout=30)
        print(f"Checkout response: {resp.status_code}")
        print(f"Response text: {resp.text}")
        print(f"Response headers: {dict(resp.headers)}")
        
        if resp.status_code == 501:
            data = resp.json()
            message = data.get("detail", "").lower()
            has_paypal_message = "paypal" in message and "noch nicht integriert" in message
            print(f"Has expected message: {has_paypal_message}")
            print(f"Message: {data.get('detail', '')}")
        
    except Exception as e:
        print(f"Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_paypal_checkout()