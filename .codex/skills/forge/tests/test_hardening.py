#!/usr/bin/env python3
"""FORGE hardening tests (v2). Run: python3 tests/test_hardening.py

Written BEFORE the implementation. Every guard is tested the way a builder agent
would try to get around it: hand-editing state, forging the log chain, signing
with the wrong key, skipping the gate, rewriting history against a baseline.
The unit under test is the CLI, so these also pin the CLI contract.
"""
import re
import hashlib, json, os, shutil, subprocess, sys, tempfile, threading, time, unittest
from pathlib import Path

FORGE = str(Path(__file__).resolve().parent.parent / "forge.py")
OWNER = "11" * 32
AUDITOR = "22" * 32
STRANGER = "33" * 32


def fp(key):
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def run(*args, env=None, cwd=None, inp=None, timeout=180):
    e = {k: v for k, v in os.environ.items() if not k.startswith("FORGE_")}
    e.update(env or {})
    return subprocess.run([sys.executable, FORGE, *args], capture_output=True, text=True,
                          env=e, cwd=cwd, input=inp, timeout=timeout)


def canon(o):
    return json.dumps(o, sort_keys=True, separators=(",", ":"))


def state_file(p):
    for n in (".forge/forge.json", "forge.json"):
        if (Path(p) / n).exists():
            return Path(p) / n
    raise FileNotFoundError(p)


def log_file(p):
    sf = state_file(p)
    return sf.with_name("log.jsonl") if sf.parent.name == ".forge" else sf.with_name("forge.log.jsonl")


def edit_state(p, fn):
    sf = state_file(p)
    st = json.loads(sf.read_text())
    fn(st)
    sf.write_text(json.dumps(st, indent=2) + "\n")


def rechain(p):
    """What a determined forger would do: recompute every hash so the log is
    internally consistent with whatever forge.json now says. Signatures and the
    baseline are what must still catch this."""
    lf = log_file(p)
    st = json.loads(state_file(p).read_text())
    ents = [json.loads(l) for l in lf.read_text().splitlines() if l.strip()]
    prev = "0" * 64
    for i, e in enumerate(ents):
        body = {k: v for k, v in e.items() if k not in ("prev", "hash")}
        if i == len(ents) - 1:
            body["state_sha"] = hashlib.sha256(canon(st).encode()).hexdigest()
        e.update(body)
        e["prev"] = prev
        e["hash"] = hashlib.sha256((prev + canon(body)).encode()).hexdigest()
        prev = e["hash"]
    lf.write_text("\n".join(json.dumps(e) for e in ents) + "\n")


class P(unittest.TestCase):
    """A fresh non-strict project."""
    strict = False

    def setUp(self):
        self.t = tempfile.mkdtemp(prefix="forge-h-")
        a = ["init", "demo", "--idea", "slugify", "--dir", self.t, "--builder", "builder-agent"]
        if self.strict:
            a.append("--strict")
        r = run(*a, env={"FORGE_OWNER_KEY": OWNER} if self.strict else None)
        assert r.returncode == 0, r.stdout + r.stderr
        self.p = os.path.join(self.t, "demo")
        if self.strict:
            r = run("keys-register", "--role", "auditor", "--fingerprint", fp(AUDITOR), "-p", self.p, env={"FORGE_OWNER_KEY": OWNER})
            assert r.returncode == 0, r.stdout + r.stderr

    def tearDown(self):
        shutil.rmtree(self.t, ignore_errors=True)

    def f(self, *a, env=None, expect=None, inp=None):
        r = run(*a, "-p", self.p, env=env, inp=inp)
        if expect is not None:
            self.assertEqual(r.returncode, expect, f"forge {' '.join(a)} -> {r.returncode}\n{r.stdout}\n{r.stderr}")
        return r

    def write(self, rel, text):
        fp_ = Path(self.p) / rel
        fp_.parent.mkdir(parents=True, exist_ok=True)
        fp_.write_text(text)

    def green(self):
        self.f("cap-add", "slugify lowercases and hyphenates", expect=0)
        self.write("tests/t1.py", "import sys; sys.path.insert(0,'build')\nfrom slug import slugify\n"
                                  "assert slugify('Hello World')=='hello-world'\n")
        self.f("cap-bind", "C1", "--file", "tests/t1.py", "--cmd", "python3 tests/t1.py", expect=0)
        self.f("verify", expect=0)
        self.write("build/slug.py", "def slugify(s): return '-'.join(s.lower().split())\n")


# ---------------------------------------------------------------- tamper-evident log
class TestLog(P):
    def test_log_written_and_clean_gate_has_no_tamper_findings(self):
        self.green()
        self.assertTrue(log_file(self.p).exists())
        ents = [json.loads(l) for l in log_file(self.p).read_text().splitlines()]
        self.assertGreaterEqual(len(ents), 4)
        self.assertEqual([e["seq"] for e in ents], list(range(1, len(ents) + 1)))
        r = self.f("gate", expect=0)
        self.assertNotIn("outside forge", r.stdout)
        self.assertNotIn("chain broken", r.stdout)

    def test_hand_edit_of_state_is_detected(self):
        self.green(); self.f("gate", expect=0)
        edit_state(self.p, lambda st: st.update(idea="quietly changed"))
        r = self.f("gate")
        self.assertEqual(r.returncode, 2); self.assertIn("outside forge", r.stdout)

    def test_hand_edit_that_marks_hold_resolved_is_detected(self):
        self.green()
        self.f("hold-add", "scope", "touches billing", "--owner", "billi", expect=0)
        edit_state(self.p, lambda st: st["holds"][0].update(status="resolved", decision="fine"))
        r = self.f("gate"); self.assertEqual(r.returncode, 2); self.assertIn("outside forge", r.stdout)

    def test_tampered_log_line_is_detected(self):
        self.green()
        lf = log_file(self.p)
        lines = lf.read_text().splitlines()
        e = json.loads(lines[1]); e["detail"] = "nothing to see"; lines[1] = json.dumps(e)
        lf.write_text("\n".join(lines) + "\n")
        r = self.f("gate"); self.assertEqual(r.returncode, 2); self.assertIn("chain broken", r.stdout)

    def test_deleted_log_line_is_detected(self):
        self.green()
        lf = log_file(self.p)
        lines = lf.read_text().splitlines(); del lines[1]
        lf.write_text("\n".join(lines) + "\n")
        r = self.f("gate"); self.assertEqual(r.returncode, 2); self.assertIn("chain broken", r.stdout)

    def test_legacy_project_without_log_warns_then_strict_fails(self):
        self.green()
        log_file(self.p).unlink()
        r = self.f("gate", expect=0)
        self.assertIn("begins mid-history", r.stdout)
        shutil.rmtree(self.p); run("init", "demo", "--dir", self.t, "--builder", "b")
        self.green(); log_file(self.p).unlink()
        r = self.f("gate", "--strict"); self.assertEqual(r.returncode, 2)
        self.assertIn("no tamper-evident history", r.stdout)

    def test_reseal_accepts_a_manual_edit_with_a_recorded_reason(self):
        self.green(); self.f("gate", expect=0)
        edit_state(self.p, lambda st: st.update(idea="slugify (clarified)"))
        self.assertEqual(self.f("gate").returncode, 2)
        self.assertNotEqual(self.f("reseal").returncode, 0)          # reason required
        self.f("reseal", "--reason", "owner fixed the idea text by hand", expect=0)
        r = self.f("gate", expect=0)
        self.assertIn("resealed", r.stdout)                          # visible, not silent
        ents = [json.loads(l) for l in log_file(self.p).read_text().splitlines()]
        self.assertTrue(any(e["cmd"] == "reseal" for e in ents))


# ---------------------------------------------------------------- robustness
class TestRobust(P):
    def test_corrupt_state_is_a_clean_error(self):
        state_file(self.p).write_text("{not json")
        r = self.f("status")
        self.assertEqual(r.returncode, 1); self.assertNotIn("Traceback", r.stderr); self.assertIn("corrupt", r.stderr)

    def test_concurrent_commands_do_not_lose_updates(self):
        def add(i): run("cap-add", f"capability number {i}", "-p", self.p)
        ts = [threading.Thread(target=add, args=(i,)) for i in range(8)]
        [t.start() for t in ts]; [t.join() for t in ts]
        st = json.loads(state_file(self.p).read_text())
        self.assertEqual(sorted(st["capabilities"]), sorted(f"C{i}" for i in range(1, 9)))
        self.assertEqual(len({c["statement"] for c in st["capabilities"].values()}), 8)
        r = self.f("gate")
        self.assertNotIn("outside forge", r.stdout); self.assertNotIn("chain broken", r.stdout)

    def test_timeout_kills_the_whole_process_group(self):
        self.f("cap-add", "hangs", expect=0)
        self.write("tests/hang.py", "import subprocess, time\nc = subprocess.Popen(['sleep','60'])\n"
                                    "open('tests/child.pid','w').write(str(c.pid))\ntime.sleep(60)\n")
        self.f("cap-bind", "C1", "--file", "tests/hang.py", "--cmd", "python3 tests/hang.py", expect=0)
        t0 = time.time()
        r = self.f("gate", "--timeout", "2")
        self.assertLess(time.time() - t0, 30)
        self.assertEqual(r.returncode, 2)
        pid = int((Path(self.p) / "tests/child.pid").read_text())
        time.sleep(0.5)
        try:
            os.kill(pid, 0); alive = True
            try:    # a killed child nobody has reaped yet is a zombie: dead, not running
                alive = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()[0] != "Z"
            except OSError:
                pass
        except ProcessLookupError:
            alive = False
        if alive:
            os.kill(pid, 9)
        self.assertFalse(alive, "timed-out test left an orphaned child process running")

    def test_project_code_is_never_run_with_forge_keys_in_the_environment(self):
        self.green()
        for cmd in (("gate",), ("verify",), ("report",)):
            r = self.f(*cmd, env={"FORGE_OWNER_KEY": OWNER})
            self.assertEqual(r.returncode, 1, cmd); self.assertIn("refus", r.stderr)
        mf = Path(self.p) / "m.json"; mf.write_text("[]")
        self.assertEqual(self.f("mutate", "--mutations", str(mf), env={"FORGE_AUDITOR_KEY": AUDITOR}).returncode, 1)
        self.assertEqual(self.f("status", env={"FORGE_OWNER_KEY": OWNER}).returncode, 0)


# ---------------------------------------------------------------- keys and signed decisions
class TestKeys(unittest.TestCase):
    def test_keygen_makes_distinct_keys_and_writes_nothing(self):
        d = tempfile.mkdtemp()
        try:
            a = run("keygen", cwd=d); b = run("keygen", cwd=d)
            self.assertEqual(a.returncode, 0)
            ka = [l.split(": ", 1)[1] for l in a.stdout.splitlines() if l.startswith("key: ")][0]
            kb = [l.split(": ", 1)[1] for l in b.stdout.splitlines() if l.startswith("key: ")][0]
            self.assertEqual(len(ka), 64); self.assertNotEqual(ka, kb)
            self.assertIn(f"fingerprint: {fp(ka)}", a.stdout)
            self.assertEqual(os.listdir(d), [])
        finally:
            shutil.rmtree(d)

    def test_strict_init_needs_the_owner_key(self):
        d = tempfile.mkdtemp()
        try:
            r = run("init", "x", "--dir", d, "--builder", "b", "--strict")
            self.assertEqual(r.returncode, 1); self.assertIn("FORGE_OWNER_KEY", r.stderr)
            self.assertFalse((Path(d) / "x").exists())
        finally:
            shutil.rmtree(d)


class TestStrict(P):
    strict = True

    def hold(self):
        self.f("hold-add", "stop-condition", "touches real payments", "--owner", "billi", expect=0)

    def test_hold_resolution_needs_the_owner_key(self):
        self.green(); self.hold()
        self.assertNotEqual(self.f("hold-resolve", "H1", "--by", "billi", "--decision", "ok").returncode, 0)
        self.assertNotEqual(self.f("hold-resolve", "H1", "--by", "billi", "--decision", "ok", env={"FORGE_OWNER_KEY": STRANGER}).returncode, 0)
        self.assertNotEqual(self.f("hold-resolve", "H1", "--by", "billi", "--decision", "ok", env={"FORGE_OWNER_KEY": AUDITOR}).returncode, 0)
        self.f("hold-resolve", "H1", "--by", "billi", "--decision", "sandbox keys only", env={"FORGE_OWNER_KEY": OWNER}, expect=0)
        st = json.loads(state_file(self.p).read_text())
        self.assertTrue(st["holds"][0].get("sig"))
        self.assertEqual(self.f("gate").returncode, 0)                       # presence-only locally
        self.f("signatures", env={"FORGE_OWNER_KEY": OWNER}, expect=0)       # full check with the key

    def test_forged_resolution_without_signature_fails_even_with_a_valid_chain(self):
        self.green(); self.hold()
        edit_state(self.p, lambda st: st["holds"][0].update(status="resolved", decision="self-approved"))
        rechain(self.p)
        r = self.f("gate"); self.assertEqual(r.returncode, 2); self.assertIn("unsigned", r.stdout)

    def test_forged_signature_fails_when_the_key_is_available(self):
        self.green(); self.hold()
        edit_state(self.p, lambda st: st["holds"][0].update(status="resolved", decision="self-approved", sig="ab" * 32))
        rechain(self.p)
        self.assertEqual(self.f("gate").returncode, 0)                       # cannot tell without the key
        r = self.f("signatures", env={"FORGE_OWNER_KEY": OWNER})
        self.assertEqual(r.returncode, 2); self.assertIn("invalid signature", r.stdout)

    def test_signature_binds_the_decision_text(self):
        self.green(); self.hold()
        self.f("hold-resolve", "H1", "--by", "billi", "--decision", "sandbox keys only", env={"FORGE_OWNER_KEY": OWNER}, expect=0)
        edit_state(self.p, lambda st: st["holds"][0].update(decision="use the live keys"))
        rechain(self.p)
        r = self.f("signatures", env={"FORGE_OWNER_KEY": OWNER})
        self.assertEqual(r.returncode, 2); self.assertIn("invalid signature", r.stdout)

    def test_require_signatures_fails_without_keys(self):
        self.green(); self.hold()
        self.f("hold-resolve", "H1", "--by", "billi", "--decision", "fine", env={"FORGE_OWNER_KEY": OWNER}, expect=0)
        r = self.f("signatures")
        self.assertEqual(r.returncode, 2); self.assertIn("cannot verify", r.stdout)

    def test_audit_needs_the_auditor_key_not_the_owner_key(self):
        self.green()
        args = ["audit-set", "functional", "--status", "checked", "--by", "auditor", "--note", "slugify verified on edge inputs", "--evidence", "probe.py"]
        self.assertNotEqual(self.f(*args).returncode, 0)
        self.assertNotEqual(self.f(*args, env={"FORGE_OWNER_KEY": OWNER}).returncode, 0)
        self.assertNotEqual(self.f(*args, env={"FORGE_AUDITOR_KEY": STRANGER}).returncode, 0)
        self.f(*args, env={"FORGE_AUDITOR_KEY": AUDITOR}, expect=0)
        self.assertNotEqual(self.f("audit-set", "errors", "--status", "inapplicable", "--by", "builder-agent",
                                   "--note", "no error surface", env={"FORGE_AUDITOR_KEY": AUDITOR}).returncode, 0)

    def test_forged_audit_entries_are_caught(self):
        self.green()
        def forge_audit(st):
            for k in ("functional", "integration", "errors", "data", "security", "performance", "conformance", "regression", "deployment"):
                st["audit"][k] = {"status": "inapplicable", "note": "not applicable here", "evidence": "", "by": "auditor", "at": "x", "severity": "none"}
        edit_state(self.p, forge_audit); rechain(self.p)
        r = self.f("gate"); self.assertEqual(r.returncode, 2); self.assertIn("unsigned", r.stdout)

    def test_inline_accept_risk_is_refused_and_source_accept_is_owner_signed(self):
        self.green()
        d = Path(tempfile.mkdtemp()); (d / "LICENSE").write_text("GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007\n")
        try:
            self.assertNotEqual(self.f("source-add", "C1", str(d), "--accept-risk", "i accept").returncode, 0)
            self.f("source-add", "C1", str(d), "--taken", "helper", expect=0)
            self.assertEqual(self.f("gate").returncode, 2)
            self.assertNotEqual(self.f("source-accept", str(d), "--decision", "GPL is fine here").returncode, 0)
            self.f("source-accept", str(d), "--decision", "app will be GPL", env={"FORGE_OWNER_KEY": OWNER}, expect=0)
            self.assertEqual(self.f("gate").returncode, 0)
            self.f("signatures", env={"FORGE_OWNER_KEY": OWNER}, expect=0)
        finally:
            shutil.rmtree(d)

    def test_strict_rebind_waits_for_a_signed_owner_ack(self):
        self.green(); self.f("gate", expect=0)
        self.write("tests/t1b.py", "print('replacement')\n")
        r = self.f("cap-bind", "C1", "--file", "tests/t1b.py", "--cmd", "python3 tests/t1b.py", "--reason", "spec changed", expect=0)
        import re
        m = re.search(r"ack rebind (\S+)", r.stdout); self.assertTrue(m, r.stdout)
        g = self.f("gate"); self.assertEqual(g.returncode, 2); self.assertIn("awaiting owner ack", g.stdout)
        self.assertNotEqual(self.f("ack", "rebind", m.group(1), "--note", "seen").returncode, 0)   # no key
        self.f("ack", "rebind", m.group(1), "--note", "owner reviewed the reason", env={"FORGE_OWNER_KEY": OWNER}, expect=0)
        self.assertEqual(self.f("gate").returncode, 0)
        self.f("signatures", env={"FORGE_OWNER_KEY": OWNER}, expect=0)

    def test_spec_approval_is_signed_and_goes_stale_when_the_spec_changes(self):
        self.green(); self.f("gate", expect=0)
        st = json.loads(state_file(self.p).read_text())
        import subprocess as sp_
        ref = re.findall(r"spec ref: ([0-9a-f]{12})", self.f("status").stdout)
        self.assertTrue(ref, "status must print the current spec ref")
        self.assertNotEqual(self.f("ack", "spec", ref[0], "--note", "approved").returncode, 0)      # no key
        self.assertNotEqual(self.f("ack", "spec", "000000000000", "--note", "approved", env={"FORGE_OWNER_KEY": OWNER}).returncode, 0)
        self.f("ack", "spec", ref[0], "--note", "owner reviewed what done means", env={"FORGE_OWNER_KEY": OWNER}, expect=0)
        self.assertEqual(self.f("gate").returncode, 0)
        self.f("cap-add", "a second promise", expect=0)             # the builder widens the spec
        g = self.f("gate"); self.assertEqual(g.returncode, 2); self.assertIn("spec changed since the owner", g.stdout)
        self.assertEqual(self.f("signatures", env={"FORGE_OWNER_KEY": OWNER}).returncode, 2)
        ref2 = re.findall(r"spec ref: ([0-9a-f]{12})", self.f("status").stdout)[0]
        self.f("ack", "spec", ref2, "--note", "owner approved the added promise", env={"FORGE_OWNER_KEY": OWNER}, expect=0)
        self.f("signatures", env={"FORGE_OWNER_KEY": OWNER}, expect=0)

    def test_reseal_in_strict_needs_the_owner_key(self):
        self.green()
        edit_state(self.p, lambda st: st.update(idea="edited"))
        self.assertNotEqual(self.f("reseal", "--reason", "my own edit").returncode, 0)
        self.f("reseal", "--reason", "owner edit", env={"FORGE_OWNER_KEY": OWNER}, expect=0)
        self.f("signatures", env={"FORGE_OWNER_KEY": OWNER}, expect=0)

    def test_registered_keys_cannot_be_swapped_by_hand_against_a_baseline(self):
        self.green()
        base = os.path.join(self.t, "base"); shutil.copytree(self.p, base)
        edit_state(self.p, lambda st: st["keys"].update(owner=fp(STRANGER)))
        rechain(self.p)
        r = self.f("gate", "--baseline", base); self.assertEqual(r.returncode, 2); self.assertIn("registered key", r.stdout)


# ---------------------------------------------------------------- bindings
class TestBindings(P):
    def test_directory_and_glob_binding_allows_additions_but_not_edits(self):
        self.f("cap-add", "suite", expect=0)
        self.write("tests/a.py", "print('a')\n"); self.write("tests/b.py", "print('b')\n")
        self.f("cap-bind", "C1", "--file", "tests/", "--cmd", "python3 tests/a.py && python3 tests/b.py", expect=0)
        self.f("verify", expect=0)
        self.write("tests/c.py", "print('c')\n")                        # additive: allowed
        r = self.f("gate"); self.assertNotIn("changed after binding", r.stdout)
        self.write("tests/a.py", "print('weakened')\n")                  # edit: reopens
        r = self.f("gate"); self.assertEqual(r.returncode, 2); self.assertIn("test changed after binding", r.stdout)

    def test_deleting_a_bound_test_fails(self):
        self.f("cap-add", "suite", expect=0)
        self.write("tests/a.py", "print('a')\n"); self.write("tests/b.py", "print('b')\n")
        self.f("cap-bind", "C1", "--file", "tests/*.py", "--cmd", "python3 tests/a.py", expect=0)
        self.f("verify", expect=0)
        (Path(self.p) / "tests/b.py").unlink()
        r = self.f("gate"); self.assertEqual(r.returncode, 2)

    def test_binding_cannot_escape_the_project(self):
        self.f("cap-add", "x", expect=0)
        (Path(self.t) / "outside.py").write_text("print('outside the project')\n")   # real files, so only the escape rule can refuse
        (Path(self.t) / "x").write_text("x\n"); (Path(self.p) / "tests").mkdir(exist_ok=True)
        for spec in ("../outside.py", "tests/../../x", str(Path(self.t) / "outside.py")):
            r = self.f("cap-bind", "C1", "--file", spec, "--cmd", "true")
            self.assertEqual(r.returncode, 1, spec); self.assertIn("outside the project", r.stderr)

    def test_retrofit_capability_is_labelled_not_pretended_test_first(self):
        self.write("build/slug.py", "def slugify(s): return '-'.join(s.lower().split())\n")
        self.f("cap-add", "existing behaviour keeps working", "--retrofit", expect=0)
        self.write("tests/t.py", "import sys; sys.path.insert(0,'build')\nfrom slug import slugify\nassert slugify('A B')=='a-b'\n")
        self.f("cap-bind", "C1", "--file", "tests/t.py", "--cmd", "python3 tests/t.py", expect=0)
        r = self.f("gate", expect=0)
        self.assertNotIn("never seen failing", r.stdout)
        self.assertIn("retrofit", r.stdout)


# ---------------------------------------------------------------- baseline (CI root of trust)
class TestBaseline(P):
    def snap(self):
        b = os.path.join(self.t, "base"); shutil.copytree(self.p, b, dirs_exist_ok=True); return b

    def test_unchanged_project_passes_against_its_baseline(self):
        self.green()
        b = self.snap()
        self.f("cap-add", "second", expect=0)                             # growth is fine
        r = self.f("gate", "--baseline", b)                               # exit 2 is expected: C2 has no test yet
        for msg in ("changed vs baseline", "not a prefix", "missing from current", "differs from baseline"):
            self.assertNotIn(msg, r.stdout)
        self.assertIn("C2: no test bound", r.stdout)

    def test_rewritten_history_is_detected(self):
        self.green(); b = self.snap()
        lf = log_file(self.p)
        lines = lf.read_text().splitlines()
        e = json.loads(lines[0]); e["detail"] = "rewritten"; lines[0] = json.dumps(e)
        lf.write_text("\n".join(lines) + "\n"); rechain(self.p)
        r = self.f("gate", "--baseline", b); self.assertEqual(r.returncode, 2); self.assertIn("not a prefix", r.stdout)

    def test_capability_statement_changed_without_ack(self):
        self.green(); b = self.snap()
        edit_state(self.p, lambda st: st["capabilities"]["C1"].update(statement="something easier")); rechain(self.p)
        r = self.f("gate", "--baseline", b); self.assertEqual(r.returncode, 2); self.assertIn("changed vs baseline", r.stdout)

    def test_test_command_swapped_for_true_without_ack(self):
        self.green(); b = self.snap()
        edit_state(self.p, lambda st: st["capabilities"]["C1"]["test"].update(cmd="true")); rechain(self.p)
        r = self.f("gate", "--baseline", b); self.assertEqual(r.returncode, 2); self.assertIn("changed vs baseline", r.stdout)

    def test_capability_removed(self):
        self.green(); self.f("cap-add", "second", expect=0); b = self.snap()
        edit_state(self.p, lambda st: st["capabilities"].pop("C2")); rechain(self.p)
        r = self.f("gate", "--baseline", b); self.assertEqual(r.returncode, 2); self.assertIn("missing from current", r.stdout)

    def test_hold_deleted(self):
        self.green(); self.f("hold-add", "scope", "touches billing", "--owner", "billi", expect=0); b = self.snap()
        edit_state(self.p, lambda st: st["holds"].clear()); rechain(self.p)
        r = self.f("gate", "--baseline", b); self.assertEqual(r.returncode, 2); self.assertIn("missing from current", r.stdout)

    def test_gap_removed(self):
        self.green(); self.f("gap", "no web page built", expect=0); b = self.snap()
        edit_state(self.p, lambda st: st["gaps"].clear()); rechain(self.p)
        r = self.f("gate", "--baseline", b); self.assertEqual(r.returncode, 2); self.assertIn("missing from current", r.stdout)

    def test_acked_rebind_is_allowed_against_baseline(self):
        self.green(); b = self.snap()
        self.write("tests/t1b.py", "import sys; sys.path.insert(0,'build')\nfrom slug import slugify\nassert slugify('A B')=='a-b'\n")
        r = self.f("cap-bind", "C1", "--file", "tests/t1b.py", "--cmd", "python3 tests/t1b.py", "--reason", "tighter spec", expect=0)
        g = self.f("gate", "--baseline", b)
        self.assertEqual(g.returncode, 2); self.assertIn("changed vs baseline", g.stdout)
        import re
        ref = re.search(r"ack rebind (\S+)", r.stdout).group(1)
        self.f("ack", "rebind", ref, "--note", "reviewed", expect=0)
        self.assertEqual(self.f("gate", "--baseline", b).returncode, 0)

    def test_vendored_forge_py_differing_from_baseline_needs_an_ack(self):
        self.green()
        (Path(self.p) / ".forge").mkdir(exist_ok=True); (Path(self.p) / ".forge/forge.py").write_text("# trusted\n")
        b = self.snap()
        new = "# modified by the builder\n"
        (Path(self.p) / ".forge/forge.py").write_text(new)
        r = self.f("gate", "--baseline", b); self.assertEqual(r.returncode, 2); self.assertIn("forge.py differs from baseline", r.stdout)
        ref = hashlib.sha256(new.encode()).hexdigest()[:12]
        self.f("ack", "forge-update", ref, "--note", "owner reviewed the diff", expect=0)
        self.assertEqual(self.f("gate", "--baseline", b).returncode, 0)

    def test_strict_mode_cannot_be_lowered(self):
        d = tempfile.mkdtemp()
        try:
            run("init", "s", "--dir", d, "--builder", "b", "--strict", env={"FORGE_OWNER_KEY": OWNER})
            p = os.path.join(d, "s"); b = os.path.join(d, "base"); shutil.copytree(p, b)
            edit_state(p, lambda st: st.update(strict=False)); rechain(p)
            r = run("gate", "-p", p, "--baseline", b)
            self.assertEqual(r.returncode, 2); self.assertIn("strict mode lowered", r.stdout)
        finally:
            shutil.rmtree(d)


# ---------------------------------------------------------------- hooks
def transcript(path, steps):
    """steps: ('user', text) ('bash', cmd) ('result', text, is_error) ('say', text)"""
    lines = []
    for i, s in enumerate(steps):
        ts = f"2026-10-25T12:00:{i:02d}.000Z"
        if s[0] == "user":
            lines.append({"type": "user", "timestamp": ts, "message": {"role": "user", "content": [{"type": "text", "text": s[1]}]}})
        elif s[0] == "bash":
            lines.append({"type": "assistant", "timestamp": ts, "message": {"role": "assistant", "content": [{"type": "tool_use", "id": f"t{i}", "name": "Bash", "input": {"command": s[1]}}]}})
        elif s[0] == "result":
            lines.append({"type": "user", "timestamp": ts, "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": f"t{i-1}", "content": s[1], **({"is_error": True} if len(s) > 2 and s[2] else {})}]}})
        elif s[0] == "say":
            lines.append({"type": "assistant", "timestamp": ts, "message": {"role": "assistant", "content": [{"type": "text", "text": s[1]}]}})
    Path(path).write_text("\n".join(json.dumps(l) for l in lines) + "\n")


class TestStopHook(P):
    def stop(self, steps, active=False, session="s1", project=None):
        tp = os.path.join(self.t, "tx.jsonl"); transcript(tp, steps)
        payload = {"session_id": session, "transcript_path": tp, "cwd": project or self.p,
                   "hook_event_name": "Stop", "stop_hook_active": active}
        return run("hook-stop", "-p", project or self.p, inp=json.dumps(payload))

    def test_no_claim_no_block(self):
        self.green()
        self.assertEqual(self.stop([("user", "go"), ("say", "I wrote the test and the next step is the implementation.")]).returncode, 0)

    def test_claim_without_a_gate_run_is_blocked(self):
        self.green()
        r = self.stop([("user", "go"), ("say", "All done, the tests pass.")])
        self.assertEqual(r.returncode, 2); self.assertIn("completion claim blocked", r.stderr); self.assertIn("forge.py gate", r.stderr)

    def test_claim_after_fresh_passing_gate_is_allowed(self):
        self.green(); self.f("gate", expect=0)
        self.assertEqual(self.stop([("user", "go"), ("say", "All done, the tests pass.")]).returncode, 0)

    def test_claim_after_a_later_change_is_stale_and_blocked(self):
        self.green(); self.f("gate", expect=0)
        self.write("build/slug.py", "def slugify(s): return s  # changed after the gate\n")
        r = self.stop([("user", "go"), ("say", "Fixed and ready.")])
        self.assertEqual(r.returncode, 2); self.assertIn("completion claim blocked", r.stderr); self.assertIn("changed since", r.stderr)

    def test_claim_after_a_failing_gate_is_blocked(self):
        self.green(); self.write("build/slug.py", "def slugify(s): return s\n")
        self.f("gate")
        r = self.stop([("user", "go"), ("say", "Everything works now.")])
        self.assertEqual(r.returncode, 2); self.assertIn("completion claim blocked", r.stderr); self.assertIn("failed", r.stderr)

    def test_hedged_and_negated_claims_are_not_blocked(self):
        self.green()
        for t in ("It should work, but it is not yet verified.", "This isn't done: C2 is still open.",
                  "I haven't confirmed it works.", "Is it ready? I can't say yet."):
            self.assertEqual(self.stop([("user", "go"), ("say", t)]).returncode, 0, t)

    def test_claim_inside_a_code_block_is_ignored(self):
        self.green()
        self.assertEqual(self.stop([("user", "go"), ("say", "Example output:\n```\nAll done and ready.\n```\n")]).returncode, 0)

    def test_audited_claim_needs_a_complete_audit(self):
        self.green(); self.f("gate", expect=0)
        r = self.stop([("user", "go"), ("say", "The build is complete and fully audited.")])
        self.assertEqual(r.returncode, 2); self.assertIn("completion claim blocked", r.stderr); self.assertIn("audit", r.stderr)

    def test_bounded_blocks_then_a_logged_override(self):
        self.green()
        steps = [("user", "go"), ("say", "All done.")]
        self.assertIn("completion claim blocked", self.stop(steps).stderr)
        self.assertEqual(self.stop(steps).returncode, 2)
        self.assertEqual(self.stop(steps, active=True).returncode, 2)
        self.assertEqual(self.stop(steps, active=True).returncode, 0)           # does not trap the session forever
        ov = Path(self.p) / ".forge/overrides.jsonl"
        self.assertTrue(ov.exists() and len(ov.read_text().splitlines()) == 1)
        self.assertIn("claim override", self.f("gate").stdout)                 # visible later, not silent

    def test_malformed_input_never_crashes_the_session(self):
        self.assertEqual(run("hook-stop", "-p", self.p, inp="not json").returncode, 0)
        self.assertEqual(run("hook-stop", "-p", self.p, inp=json.dumps({"transcript_path": "/nope"})).returncode, 0)
        self.assertEqual(run("hook-stop", "-p", self.p, inp="").returncode, 0)

    def test_without_a_forge_project_it_still_requires_test_evidence(self):
        bare = tempfile.mkdtemp(prefix="bare-")
        try:
            r = self.stop([("user", "fix it"), ("say", "Fixed, it works now.")], project=bare)
            self.assertEqual(r.returncode, 2); self.assertIn("completion claim blocked", r.stderr)
            ok = self.stop([("user", "fix it"), ("bash", "pytest -q"), ("result", "3 passed in 0.1s"), ("say", "Fixed, it works now.")], project=bare)
            self.assertEqual(ok.returncode, 0)
            bad = self.stop([("user", "fix it"), ("bash", "pytest -q"), ("result", "1 failed", True), ("say", "Fixed, it works now.")], project=bare)
            self.assertEqual(bad.returncode, 2); self.assertIn("completion claim blocked", bad.stderr)
        finally:
            shutil.rmtree(bare, ignore_errors=True)

    def test_in_a_git_repo_staleness_uses_the_working_tree(self):
        g = tempfile.mkdtemp(prefix="gitrepo-")
        try:
            subprocess.run(["git", "init", "-q", g], check=True)
            self.assertEqual(run("adopt", "-p", g, "--name", "r", "--idea", "x", "--builder", "b").returncode, 0)
            (Path(g) / "src.py").write_text("x = 1\n"); (Path(g) / "t.py").write_text("print('ok')\n")
            self.assertEqual(run("cap-add", "x", "--retrofit", "-p", g).returncode, 0)
            self.assertEqual(run("cap-bind", "C1", "--file", "t.py", "--cmd", "python3 t.py", "-p", g).returncode, 0)
            self.assertEqual(run("gate", "-p", g).returncode, 0)
            self.assertEqual(self.stop([("user", "go"), ("say", "All done.")], project=g).returncode, 0)
            (Path(g) / "src.py").write_text("x = 2\n")
            stale = self.stop([("user", "go"), ("say", "All done.")], project=g)
            self.assertEqual(stale.returncode, 2); self.assertIn("completion claim blocked", stale.stderr)
        finally:
            shutil.rmtree(g, ignore_errors=True)


class TestPreToolHook(P):
    def pre(self, tool, **inp):
        return run("hook-pretool", "-p", self.p, inp=json.dumps({"tool_name": tool, "tool_input": inp, "cwd": self.p}))

    def test_edits_to_protected_files_are_blocked(self):
        for path in ("forge.json", "/x/y/forge.json", ".forge/forge.py", ".forge/forge.json", "forge.log.jsonl",
                     ".claude/settings.json", ".claude/settings.local.json", ".claude/hooks/gate.sh"):
            for tool in ("Edit", "Write", "MultiEdit"):
                r = self.pre(tool, file_path=path)
                self.assertEqual(r.returncode, 2, (tool, path)); self.assertIn("protected", r.stderr)

    def test_ordinary_edits_are_allowed(self):
        for path in ("src/app.py", "tests/test_x.py", "docs/forge-notes.md", "forgery.json", "my.forge.json.bak.txt"):
            self.assertEqual(self.pre("Edit", file_path=path).returncode, 0, path)

    def test_shell_writes_to_protected_files_are_blocked(self):
        bad = ["sed -i 's/a/b/' forge.json", "echo '{}' > .forge/forge.json", "echo x >> forge.log.jsonl",
               "python3 -c \"open('forge.json','w').write('{}')\"", "rm .forge/last-gate.json", "mv x .forge/forge.py",
               "tee .claude/settings.json < x", "cp /tmp/evil .forge/forge.py", "git checkout -- forge.json",
               "python3 .forge/forge.py gate; echo x > forge.json"]
        for c in bad:
            r = self.pre("Bash", command=c)
            self.assertEqual(r.returncode, 2, c); self.assertIn("protected", r.stderr)

    def test_escaped_quotes_do_not_hide_a_write(self):
        cmd = 'python3 -c "open(\\".forge/forge.pin\\",\\"w\\").write(\\"x\\")"'
        r = self.pre("Bash", command=cmd)
        self.assertEqual(r.returncode, 2, cmd); self.assertIn("protected", r.stderr)

    def test_shell_reads_and_forge_runs_are_allowed(self):
        ok = ["ls -la", "cat .forge/forge.json", "python3 .forge/forge.py gate", "python3 .forge/forge.py cap-add \"a > b\"",
              "grep -n gate .forge/forge.py", "pytest -q", "git status", "echo hello > build/out.txt"]
        for c in ok:
            self.assertEqual(self.pre("Bash", command=c).returncode, 0, c)

    def test_garbage_input_never_blocks(self):
        self.assertEqual(run("hook-pretool", "-p", self.p, inp="nope").returncode, 0)
        self.assertEqual(run("hook-pretool", "-p", self.p, inp="{}").returncode, 0)


class TestSessionHook(P):
    def test_session_start_injects_the_rules_and_status(self):
        self.green()
        r = run("hook-session", "-p", self.p, inp=json.dumps({"hook_event_name": "SessionStart"}))
        self.assertEqual(r.returncode, 0)
        for s in ("forge", "gate", "should work, not verified", "C1"):
            self.assertIn(s, r.stdout)

    def test_session_start_without_a_project_still_prints_the_rules(self):
        d = tempfile.mkdtemp()
        try:
            r = run("hook-session", "-p", d, inp="{}")
            self.assertEqual(r.returncode, 0); self.assertIn("gate", r.stdout)
        finally:
            shutil.rmtree(d)


# ---------------------------------------------------------------- install / adopt / doctor
class TestInstall(unittest.TestCase):
    def setUp(self):
        self.r = tempfile.mkdtemp(prefix="repo-")
        subprocess.run(["git", "init", "-q", self.r], check=True)

    def tearDown(self):
        shutil.rmtree(self.r, ignore_errors=True)

    def snapshot(self):
        out = {}
        for root, dirs, files in os.walk(self.r):
            dirs[:] = [d for d in dirs if d != ".git"]
            for f in files:
                p = Path(root) / f; out[str(p.relative_to(self.r))] = p.read_bytes()
        return out

    def test_adopt_and_install_wire_everything(self):
        self.assertEqual(run("adopt", "-p", self.r, "--name", "app", "--idea", "x", "--builder", "claude-code").returncode, 0)
        r = run("install", "-p", self.r, "--ci", "github"); self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual((Path(self.r) / ".forge/forge.py").read_bytes(), Path(FORGE).read_bytes())
        self.assertTrue((Path(self.r) / ".forge/forge.pin").read_text().strip())
        s = json.loads((Path(self.r) / ".claude/settings.json").read_text())
        for ev in ("SessionStart", "PreToolUse", "Stop"):
            self.assertIn("forge.py", json.dumps(s["hooks"][ev]), ev)
        for doc in ("CLAUDE.md", "AGENTS.md"):
            t = (Path(self.r) / doc).read_text(); self.assertIn("forge:begin", t); self.assertIn("should work, not verified", t)
        wf = (Path(self.r) / ".github/workflows/forge-gate.yml").read_text()
        self.assertIn("--baseline", wf); self.assertIn("FORGE_OWNER_KEY", wf)
        gi = (Path(self.r) / ".gitignore").read_text(); self.assertIn(".forge/last-gate.json", gi)
        self.assertEqual(run("doctor", "-p", self.r).returncode, 0)

    def test_install_preserves_existing_settings_and_docs_and_is_idempotent(self):
        (Path(self.r) / ".claude").mkdir()
        (Path(self.r) / ".claude/settings.json").write_text(json.dumps(
            {"permissions": {"allow": ["Bash(ls:*)"]},
             "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "echo mine"}]}]}}))
        (Path(self.r) / "CLAUDE.md").write_text("# My repo\nKeep functions small.\n")
        run("adopt", "-p", self.r, "--name", "app", "--idea", "x", "--builder", "b")
        run("install", "-p", self.r, "--ci", "none")
        s = json.loads((Path(self.r) / ".claude/settings.json").read_text())
        self.assertEqual(s["permissions"]["allow"], ["Bash(ls:*)"])
        self.assertIn("echo mine", json.dumps(s["hooks"]["Stop"])); self.assertIn("forge.py", json.dumps(s["hooks"]["Stop"]))
        self.assertIn("Keep functions small.", (Path(self.r) / "CLAUDE.md").read_text())
        first = self.snapshot()
        run("install", "-p", self.r, "--ci", "none")
        self.assertEqual(self.snapshot(), first)

    def test_invalid_settings_json_is_refused_not_clobbered(self):
        (Path(self.r) / ".claude").mkdir(); bad = "{ this is not json"
        (Path(self.r) / ".claude/settings.json").write_text(bad)
        r = run("install", "-p", self.r)
        self.assertEqual(r.returncode, 1)
        self.assertEqual((Path(self.r) / ".claude/settings.json").read_text(), bad)

    def test_dry_run_writes_nothing(self):
        before = self.snapshot()
        r = run("install", "-p", self.r, "--dry-run"); self.assertEqual(r.returncode, 0)
        self.assertEqual(self.snapshot(), before); self.assertIn("would", r.stdout)

    def test_doctor_catches_tampering_and_missing_hooks(self):
        run("adopt", "-p", self.r, "--name", "app", "--idea", "x", "--builder", "b"); run("install", "-p", self.r, "--ci", "none")
        self.assertEqual(run("doctor", "-p", self.r).returncode, 0)
        vend = Path(self.r) / ".forge/forge.py"; orig = vend.read_text()
        vend.write_text(orig + "\n# sneaky\n")
        d = run("doctor", "-p", self.r); self.assertEqual(d.returncode, 2); self.assertIn("pin", d.stdout)
        vend.write_text(orig)
        sp = Path(self.r) / ".claude/settings.json"; s = json.loads(sp.read_text()); s["hooks"].pop("Stop"); sp.write_text(json.dumps(s))
        d = run("doctor", "-p", self.r); self.assertEqual(d.returncode, 2); self.assertIn("Stop", d.stdout)

    def test_adopt_detects_the_test_command_and_can_baseline_the_suite(self):
        (Path(self.r) / "tests").mkdir(); (Path(self.r) / "src").mkdir()
        (Path(self.r) / "src/calc.py").write_text("def add(a, b): return a + b\n")
        (Path(self.r) / "tests/test_calc.py").write_text("import sys, unittest\nsys.path.insert(0, 'src')\nfrom calc import add\n"
                                                         "class T(unittest.TestCase):\n    def test_add(self): self.assertEqual(add(1, 2), 3)\n"
                                                         "if __name__ == '__main__': unittest.main()\n")
        (Path(self.r) / "package.json").write_text(json.dumps({"scripts": {"test": "jest"}}))
        r = run("adopt", "-p", self.r, "--name", "app", "--idea", "x", "--builder", "b",
                "--baseline-suite", "--suite-cmd", "python3 -m unittest discover -s tests")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr); self.assertIn("npm test", r.stdout)   # detection listed
        st = json.loads(state_file(self.r).read_text())
        c = st["capabilities"]["C1"]; self.assertTrue(c.get("retrofit")); self.assertIn("tests/test_calc.py", c["test"]["files"])
        self.assertEqual(run("gate", "-p", self.r).returncode, 0)
        (Path(self.r) / "src/calc.py").write_text("def add(a, b): return a - b\n")
        self.assertEqual(run("gate", "-p", self.r).returncode, 2)             # the suite now guards real behaviour

    def test_adopt_strict_needs_the_owner_key_and_registers_it(self):
        self.assertNotEqual(run("adopt", "-p", self.r, "--name", "a", "--idea", "x", "--builder", "b", "--strict").returncode, 0)
        self.assertEqual(run("adopt", "-p", self.r, "--name", "a", "--idea", "x", "--builder", "b", "--strict",
                             env={"FORGE_OWNER_KEY": OWNER}).returncode, 0)
        st = json.loads(state_file(self.r).read_text()); self.assertEqual(st["keys"]["owner"], fp(OWNER)); self.assertTrue(st["strict"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
