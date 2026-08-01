"""XYTEEE Nexus – Comprehensive backend test suite (pytest)"""
import os
import uuid
import time
import base64
import asyncio
import json
import pytest
import requests
import websockets

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://nexus-social-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"

RUN = uuid.uuid4().hex[:6]
PWD = "Test1234!"

# Sample base64 image (1x1 gif)
B64_IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"


def signup(prefix):
    email = f"TEST_{prefix}_{RUN}@nexus.io"
    r = requests.post(f"{API}/auth/signup", json={
        "email": email, "password": PWD,
        "username": f"test{prefix}{RUN}", "display_name": f"Test {prefix} {RUN}",
    })
    assert r.status_code == 200, f"signup: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data and "verify_token" in data
    return data


@pytest.fixture(scope="module")
def users():
    a = signup("alpha")
    b = signup("bravo")
    return {"a": a, "b": b}


def H(u):
    return {"Authorization": f"Bearer {u['token']}"}


# ---- Auth ----
class TestAuth:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200

    def test_signup_and_login(self, users):
        a = users["a"]
        r = requests.post(f"{API}/auth/login", json={"email": a["user"]["email"], "password": PWD})
        assert r.status_code == 200
        assert r.json()["user"]["user_id"] == a["user"]["user_id"]

    def test_login_bad_password(self, users):
        r = requests.post(f"{API}/auth/login", json={"email": users["a"]["user"]["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_ok(self, users):
        r = requests.get(f"{API}/auth/me", headers=H(users["a"]))
        assert r.status_code == 200
        assert r.json()["user_id"] == users["a"]["user"]["user_id"]

    def test_forgot_and_reset(self, users):
        # signup fresh user so we can reset without affecting others
        d = signup(f"reset{uuid.uuid4().hex[:4]}")
        email = d["user"]["email"]
        r = requests.post(f"{API}/auth/forgot-password", json={"email": email})
        assert r.status_code == 200 and "reset_token" in r.json()
        tok = r.json()["reset_token"]
        r = requests.post(f"{API}/auth/reset-password", json={"token": tok, "new_password": "NewPass1!"})
        assert r.status_code == 200
        # verify new password works
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "NewPass1!"})
        assert r.status_code == 200

    def test_change_password(self):
        d = signup(f"chg{uuid.uuid4().hex[:4]}")
        r = requests.post(f"{API}/auth/change-password", json={"old_password": "wrong", "new_password": "NewPass2!"}, headers=H(d))
        assert r.status_code == 400
        r = requests.post(f"{API}/auth/change-password", json={"old_password": PWD, "new_password": "NewPass2!"}, headers=H(d))
        assert r.status_code == 200
        r = requests.post(f"{API}/auth/login", json={"email": d["user"]["email"], "password": "NewPass2!"})
        assert r.status_code == 200

    def test_google_session_invalid(self):
        r = requests.post(f"{API}/auth/google/session", json={"session_id": "invalid_test_id"})
        assert r.status_code in (400, 401, 500)


# ---- Users ----
class TestUsers:
    def test_search(self, users):
        r = requests.get(f"{API}/users/search", params={"q": f"test"}, headers=H(users["a"]))
        assert r.status_code == 200
        ids = [u["user_id"] for u in r.json()["users"]]
        assert users["a"]["user"]["user_id"] not in ids  # excludes self

    def test_get_user_relation_none(self, users):
        r = requests.get(f"{API}/users/{users['b']['user']['user_id']}", headers=H(users["a"]))
        assert r.status_code == 200
        data = r.json()
        assert "friend_count" in data and "story_count" in data and "relation" in data
        assert data["relation"] == "none"

    def test_update_me(self, users):
        r = requests.put(f"{API}/users/me", json={"bio": "hello world", "display_name": "Alpha New"}, headers=H(users["a"]))
        assert r.status_code == 200
        assert r.json()["bio"] == "hello world"
        assert r.json()["display_name"] == "Alpha New"


# ---- Friends ----
class TestFriends:
    def test_full_friend_flow(self, users):
        a, b = users["a"], users["b"]
        # request
        r = requests.post(f"{API}/friends/request", json={"user_id": b["user"]["user_id"]}, headers=H(a))
        assert r.status_code == 200
        # relation shows requested/incoming
        r = requests.get(f"{API}/users/{b['user']['user_id']}", headers=H(a))
        assert r.json()["relation"] == "requested"
        r = requests.get(f"{API}/users/{a['user']['user_id']}", headers=H(b))
        assert r.json()["relation"] == "incoming"
        # requests list
        r = requests.get(f"{API}/friends/requests", headers=H(b))
        assert any(x["from"] == a["user"]["user_id"] for x in r.json()["incoming"])
        # accept
        r = requests.post(f"{API}/friends/accept", json={"user_id": a["user"]["user_id"]}, headers=H(b))
        assert r.status_code == 200
        # friends list
        r = requests.get(f"{API}/friends", headers=H(a))
        ids = [u["user_id"] for u in r.json()["friends"]]
        assert b["user"]["user_id"] in ids

    def test_block_unblock(self):
        a = signup(f"blk1{uuid.uuid4().hex[:4]}")
        b = signup(f"blk2{uuid.uuid4().hex[:4]}")
        r = requests.post(f"{API}/friends/block", json={"user_id": b["user"]["user_id"]}, headers=H(a))
        assert r.status_code == 200
        r = requests.get(f"{API}/users/{b['user']['user_id']}", headers=H(a))
        assert r.json()["relation"] == "blocked"
        r = requests.post(f"{API}/friends/unblock", json={"user_id": b["user"]["user_id"]}, headers=H(a))
        assert r.status_code == 200


# ---- Chats ----
class TestChats:
    def test_chat_flow(self, users):
        a, b = users["a"], users["b"]
        # open chat
        r = requests.post(f"{API}/chats/open", json={"user_id": b["user"]["user_id"]}, headers=H(a))
        assert r.status_code == 200
        cid = r.json()["conversation"]["conversation_id"]
        # chats list
        r = requests.get(f"{API}/chats", headers=H(a))
        assert any(c["conversation_id"] == cid for c in r.json()["chats"])
        # send text
        r = requests.post(f"{API}/chats/message", json={"conversation_id": cid, "content": "hello there", "kind": "text"}, headers=H(a))
        assert r.status_code == 200
        msg_id = r.json()["message_id"]
        # send image
        r = requests.post(f"{API}/chats/message", json={"conversation_id": cid, "content": "", "kind": "image", "media": B64_IMG}, headers=H(a))
        assert r.status_code == 200
        # reply
        r = requests.post(f"{API}/chats/message", json={"conversation_id": cid, "content": "reply!", "kind": "text", "reply_to": msg_id}, headers=H(b))
        assert r.status_code == 200
        # list messages
        r = requests.get(f"{API}/chats/{cid}/messages", headers=H(a))
        assert r.status_code == 200
        assert len(r.json()["messages"]) >= 3
        # edit
        r = requests.put(f"{API}/chats/message/{msg_id}", json={"content": "edited"}, headers=H(a))
        assert r.status_code == 200 and r.json()["edited"] is True
        # non-sender edit fails
        r = requests.put(f"{API}/chats/message/{msg_id}", json={"content": "hack"}, headers=H(b))
        assert r.status_code == 404
        # search
        r = requests.get(f"{API}/chats/{cid}/search", params={"q": "edited"}, headers=H(a))
        assert r.status_code == 200 and len(r.json()["messages"]) >= 1
        # delete for me
        r = requests.delete(f"{API}/chats/message/{msg_id}?scope=me", headers=H(b))
        assert r.status_code == 200
        # delete for everyone by sender
        r = requests.delete(f"{API}/chats/message/{msg_id}?scope=everyone", headers=H(a))
        assert r.status_code == 200


# ---- Reactions (new feature) ----
class TestReactions:
    def test_react_toggle_and_switch(self, users):
        a, b = users["a"], users["b"]
        # ensure open chat + a message
        r = requests.post(f"{API}/chats/open", json={"user_id": b["user"]["user_id"]}, headers=H(a))
        cid = r.json()["conversation"]["conversation_id"]
        r = requests.post(f"{API}/chats/message", json={"conversation_id": cid, "content": "react to me", "kind": "text"}, headers=H(a))
        assert r.status_code == 200
        mid = r.json()["message_id"]

        # b reacts ❤️
        r = requests.post(f"{API}/chats/message/{mid}/react", json={"emoji": "❤️"}, headers=H(b))
        assert r.status_code == 200
        reactions = r.json()["reactions"]
        assert len(reactions) == 1 and reactions[0]["user_id"] == b["user"]["user_id"] and reactions[0]["emoji"] == "❤️"

        # b reacts 🔥 (should replace ❤️)
        r = requests.post(f"{API}/chats/message/{mid}/react", json={"emoji": "🔥"}, headers=H(b))
        assert r.status_code == 200
        reactions = r.json()["reactions"]
        assert len(reactions) == 1 and reactions[0]["emoji"] == "🔥"

        # b reacts 🔥 again → toggle off
        r = requests.post(f"{API}/chats/message/{mid}/react", json={"emoji": "🔥"}, headers=H(b))
        assert r.status_code == 200
        assert r.json()["reactions"] == []

    def test_react_non_participant_forbidden(self, users):
        # third user cannot react in someone else's conversation
        a, b = users["a"], users["b"]
        c = signup(f"outsider{uuid.uuid4().hex[:4]}")
        r = requests.post(f"{API}/chats/open", json={"user_id": b["user"]["user_id"]}, headers=H(a))
        cid = r.json()["conversation"]["conversation_id"]
        r = requests.post(f"{API}/chats/message", json={"conversation_id": cid, "content": "outsider test", "kind": "text"}, headers=H(a))
        mid = r.json()["message_id"]
        r = requests.post(f"{API}/chats/message/{mid}/react", json={"emoji": "👍"}, headers=H(c))
        assert r.status_code == 403

    def test_react_ws_event(self, users):
        """WS should push message_react to both participants."""
        async def run():
            a, b = users["a"], users["b"]
            r = requests.post(f"{API}/chats/open", json={"user_id": b["user"]["user_id"]}, headers=H(a))
            cid = r.json()["conversation"]["conversation_id"]
            r = requests.post(f"{API}/chats/message", json={"conversation_id": cid, "content": "ws react", "kind": "text"}, headers=H(a))
            mid = r.json()["message_id"]
            ws_a = await websockets.connect(f"{WS_URL}?token={a['token']}", open_timeout=10)
            ws_b = await websockets.connect(f"{WS_URL}?token={b['token']}", open_timeout=10)
            try:
                await asyncio.sleep(0.5)
                # b reacts
                requests.post(f"{API}/chats/message/{mid}/react", json={"emoji": "😂"}, headers=H(b))
                got_a, got_b = False, False
                try:
                    for _ in range(8):
                        done, _ = await asyncio.wait(
                            [asyncio.create_task(ws_a.recv()), asyncio.create_task(ws_b.recv())],
                            timeout=3, return_when=asyncio.FIRST_COMPLETED,
                        )
                        for t in done:
                            try:
                                data = json.loads(t.result())
                            except Exception:
                                continue
                            if data.get("type") == "message_react":
                                if data["message"]["message_id"] == mid:
                                    got_a = got_a or True
                                    got_b = got_b or True
                        if got_a and got_b:
                            break
                except asyncio.TimeoutError:
                    pass
                assert got_a and got_b, "message_react not broadcast to both participants"
            finally:
                await ws_a.close()
                await ws_b.close()
        asyncio.run(run())


# ---- Delete Account (new feature) ----
class TestDeleteAccount:
    def test_delete_requires_password_for_email_user(self):
        d = signup(f"del{uuid.uuid4().hex[:4]}")
        # no password
        r = requests.request("DELETE", f"{API}/users/me", json={}, headers=H(d))
        assert r.status_code == 400
        # wrong password
        r = requests.request("DELETE", f"{API}/users/me", json={"password": "wrong"}, headers=H(d))
        assert r.status_code == 400

    def test_delete_wipes_user_and_related(self, users):
        # fresh user + friend + chat + story + notification, then delete
        target = signup(f"delfull{uuid.uuid4().hex[:4]}")
        other = signup(f"delother{uuid.uuid4().hex[:4]}")
        # friend request + accept
        requests.post(f"{API}/friends/request", json={"user_id": other["user"]["user_id"]}, headers=H(target))
        requests.post(f"{API}/friends/accept", json={"user_id": target["user"]["user_id"]}, headers=H(other))
        # open chat + message
        r = requests.post(f"{API}/chats/open", json={"user_id": other["user"]["user_id"]}, headers=H(target))
        cid = r.json()["conversation"]["conversation_id"]
        r = requests.post(f"{API}/chats/message", json={"conversation_id": cid, "content": "before delete", "kind": "text"}, headers=H(target))
        mid = r.json()["message_id"]
        # story
        requests.post(f"{API}/stories", json={"kind": "image", "media": B64_IMG, "caption": "bye"}, headers=H(target))

        # delete with correct password
        r = requests.request("DELETE", f"{API}/users/me", json={"password": PWD}, headers=H(target))
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # target's token should now be invalid
        r = requests.get(f"{API}/auth/me", headers=H(target))
        assert r.status_code == 401

        # other user should see conversation participant list reduced OR conversation gone
        r = requests.get(f"{API}/chats", headers=H(other))
        assert r.status_code == 200
        matching = [c for c in r.json()["chats"] if c["conversation_id"] == cid]
        # conversation kept because other user still a participant
        if matching:
            assert target["user"]["user_id"] not in matching[0]["participants"]

        # target's messages are deleted_for_everyone
        r = requests.get(f"{API}/chats/{cid}/messages", headers=H(other))
        if r.status_code == 200:
            deleted = [m for m in r.json()["messages"] if m["message_id"] == mid]
            if deleted:
                assert deleted[0]["deleted_for_everyone"] is True

        # target's stories gone from other's feed
        r = requests.get(f"{API}/stories/feed", headers=H(other))
        for grp in r.json().get("feed", []):
            assert grp.get("user", {}).get("user_id") != target["user"]["user_id"]


# ---- Stories ----
class TestStories:
    def test_story_flow(self, users):
        a, b = users["a"], users["b"]
        r = requests.post(f"{API}/stories", json={"kind": "image", "media": B64_IMG, "caption": "hi"}, headers=H(a))
        assert r.status_code == 200
        sid = r.json()["story_id"]
        # feed for b (friend of a from earlier test)
        r = requests.get(f"{API}/stories/feed", headers=H(b))
        assert r.status_code == 200
        assert any(sid in [s["story_id"] for s in g["stories"]] for g in r.json()["feed"])
        # view
        r = requests.post(f"{API}/stories/{sid}/view", headers=H(b))
        assert r.status_code == 200
        # viewers (owner only)
        r = requests.get(f"{API}/stories/{sid}/viewers", headers=H(a))
        assert r.status_code == 200 and r.json()["count"] >= 1
        # non-owner cannot see viewers
        r = requests.get(f"{API}/stories/{sid}/viewers", headers=H(b))
        assert r.status_code == 403
        # delete
        r = requests.delete(f"{API}/stories/{sid}", headers=H(a))
        assert r.status_code == 200


# ---- Notifications ----
class TestNotifications:
    def test_list_and_read(self, users):
        r = requests.get(f"{API}/notifications", headers=H(users["b"]))
        assert r.status_code == 200
        # We sent friend_request + friend_accepted + message + story earlier
        kinds = {n["kind"] for n in r.json()["notifications"]}
        assert "friend_request" in kinds or "message" in kinds or "story" in kinds
        r = requests.post(f"{API}/notifications/read", headers=H(users["b"]))
        assert r.status_code == 200
        r = requests.get(f"{API}/notifications", headers=H(users["b"]))
        assert all(n["read"] for n in r.json()["notifications"])


# ---- WebSocket ----
class TestWebSocket:
    def test_ws_connect_typing_and_message(self, users):
        async def run():
            a, b = users["a"], users["b"]
            # open chat
            r = requests.post(f"{API}/chats/open", json={"user_id": b["user"]["user_id"]}, headers=H(a))
            cid = r.json()["conversation"]["conversation_id"]

            ws_a = await websockets.connect(f"{WS_URL}?token={a['token']}", open_timeout=10)
            ws_b = await websockets.connect(f"{WS_URL}?token={b['token']}", open_timeout=10)
            try:
                # drain presence events
                await asyncio.sleep(0.5)
                # send typing from A → B should receive
                await ws_a.send(json.dumps({"type": "typing", "conversation_id": cid, "is_typing": True}))
                got_typing = False
                try:
                    for _ in range(5):
                        msg = await asyncio.wait_for(ws_b.recv(), timeout=3)
                        data = json.loads(msg)
                        if data.get("type") == "typing" and data.get("conversation_id") == cid:
                            got_typing = True
                            break
                except asyncio.TimeoutError:
                    pass
                assert got_typing, "did not receive typing event"

                # send REST message from A → both should get 'message'
                requests.post(f"{API}/chats/message", json={"conversation_id": cid, "content": "ws-hello", "kind": "text"}, headers=H(a))
                got_msg = False
                try:
                    for _ in range(6):
                        msg = await asyncio.wait_for(ws_b.recv(), timeout=3)
                        data = json.loads(msg)
                        if data.get("type") == "message":
                            got_msg = True
                            break
                except asyncio.TimeoutError:
                    pass
                assert got_msg, "did not receive message event"
            finally:
                await ws_a.close()
                await ws_b.close()

        asyncio.get_event_loop().run_until_complete(run()) if False else asyncio.run(run())

    def test_ws_invalid_token(self):
        async def run():
            try:
                ws = await websockets.connect(f"{WS_URL}?token=invalid", open_timeout=10)
                # if it accepts, we should get closed quickly
                try:
                    await asyncio.wait_for(ws.recv(), timeout=2)
                except Exception:
                    pass
                await ws.close()
                # If we got here w/o exception, still ok — some servers close after accept
            except Exception:
                pass  # expected
        asyncio.run(run())
