#!/usr/bin/env python3
"""FORGE test suite. Run: python3 tests/test_forge.py
Every CAS rule that FORGE claims to enforce has a test that proves it refuses
the violation, not just that it accepts the happy path."""
import json, os, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

FORGE = str(Path(__file__).resolve().parent.parent / "forge.py")
COMMON = Path("/usr/share/common-licenses")


def forge(*args, expect=None):
    r = subprocess.run([sys.executable, FORGE, *args], capture_output=True, text=True)
    if expect is not None:
        assert r.returncode == expect, f"forge {' '.join(args)} -> exit {r.returncode}, wanted {expect}\n{r.stdout}\n{r.stderr}"
    return r


class Base(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.mkdtemp(prefix="forge-test-")
        forge("init", "demo", "--idea", "slugify", "--dir", self.t, "--builder", "builder-agent", expect=0)
        self.p = os.path.join(self.t, "demo")

    def tearDown(self):
        shutil.rmtree(self.t, ignore_errors=True)

    def f(self, *a, expect=None):
        return forge(*a, "-p", self.p, expect=expect) if a[0] != "license" else forge(*a, expect=expect)

    def write(self, rel, text):
        fp = Path(self.p) / rel
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text(text)

    def green_capability(self):
        self.f("cap-add", "slugify lowercases and hyphenates", expect=0)
        self.write("tests/t1.py", "import sys; sys.path.insert(0,'build')\nfrom slug import slugify\n"
                                  "assert slugify('Hello World')=='hello-world'\n")
        self.f("cap-bind", "C1", "--file", "tests/t1.py", "--cmd", "python3 tests/t1.py", expect=0)
        self.f("verify", expect=0)  # red first: no implementation yet
        self.write("build/slug.py", "def slugify(s): return '-'.join(s.lower().split())\n")


class TestVerification(Base):
    def test_gate_fails_with_no_capabilities(self):
        self.assertEqual(self.f("gate").returncode, 2)

    def test_gate_fails_without_bound_test(self):
        self.f("cap-add", "x", expect=0)
        r = self.f("gate"); self.assertEqual(r.returncode, 2); self.assertIn("no test bound", r.stdout)

    def test_red_then_green_then_pass(self):
        self.green_capability()
        st = json.loads((Path(self.p) / "forge.json").read_text())
        self.assertEqual(st["capabilities"]["C1"]["status"], "failed")  # was red first
        r = self.f("gate"); self.assertEqual(r.returncode, 0, r.stdout); self.assertIn("GATE: PASS", r.stdout)
        self.assertNotIn("never seen failing", r.stdout)

    def test_vacuous_test_warned(self):
        self.write("build/slug.py", "def slugify(s): return s\n")
        self.f("cap-add", "x", expect=0)
        self.write("tests/t1.py", "print('ok')\n")
        self.f("cap-bind", "C1", "--file", "tests/t1.py", "--cmd", "python3 tests/t1.py", expect=0)
        r = self.f("gate"); self.assertIn("never seen failing", r.stdout)
        self.assertIn("already in build/", r.stdout)

    def test_tampered_test_reopens_and_fails(self):
        self.green_capability(); self.f("gate", expect=0)
        self.write("tests/t1.py", "print('weakened to always pass')\n")
        r = self.f("gate"); self.assertEqual(r.returncode, 2); self.assertIn("test changed after binding", r.stdout)

    def test_rebind_requires_reason_and_is_flagged(self):
        self.green_capability()
        self.write("tests/t1b.py", "print('replacement')\n")
        self.assertNotEqual(self.f("cap-bind", "C1", "--file", "tests/t1b.py", "--cmd", "python3 tests/t1b.py").returncode, 0)
        self.f("cap-bind", "C1", "--file", "tests/t1b.py", "--cmd", "python3 tests/t1b.py", "--reason", "spec changed per owner", expect=0)
        r = self.f("gate"); self.assertIn("rebound 1x", r.stdout)

    def test_rebind_preserves_red_first_history(self):
        self.green_capability()                      # was red first, then implemented
        self.write("tests/t1b.py", "import sys; sys.path.insert(0,'build')\nfrom slug import slugify\nassert slugify('A B')=='a-b'\n")
        self.f("cap-bind", "C1", "--file", "tests/t1b.py", "--cmd", "python3 tests/t1b.py", "--reason", "spec tightened", expect=0)
        r = self.f("gate", expect=0)
        self.assertNotIn("never seen failing", r.stdout)   # earlier red run still counts
        st = json.loads((Path(self.p) / "forge.json").read_text())
        self.assertEqual(st["capabilities"]["C1"]["history"][0]["exit"], 1)

    def test_failing_test_fails_gate(self):
        self.green_capability()
        self.write("build/slug.py", "def slugify(s): return s\n")
        self.assertEqual(self.f("gate").returncode, 2)

    def test_out_of_order_flagged(self):
        self.green_capability()
        self.f("cap-add", "second", expect=0)
        self.f("cap-add", "third", expect=0)
        self.write("tests/t3.py", "print('3')\n")
        self.f("cap-bind", "C3", "--file", "tests/t3.py", "--cmd", "python3 tests/t3.py", expect=0)
        r = self.f("verify"); r = self.f("gate")
        self.assertIn("out of order", r.stdout)
        self.assertIn("C2: no test bound", r.stdout)


class TestCourage(Base):
    def test_block_needs_two_paths(self):
        self.f("cap-add", "needs vendor", expect=0)
        self.assertNotEqual(self.f("cap-block", "C1", "no account").returncode, 0)
        self.assertNotEqual(self.f("cap-block", "C1", "no account", "--tried", "path A: asked vendor sandbox, refused without contract").returncode, 0)
        self.assertNotEqual(self.f("cap-block", "C1", "no account", "--tried", "short", "--tried", "tiny").returncode, 0)
        same = "path A: asked vendor sandbox, refused without contract"
        self.assertNotEqual(self.f("cap-block", "C1", "no account", "--tried", same, "--tried", same).returncode, 0)

    def test_block_with_two_paths_ok_and_reported(self):
        self.f("cap-add", "needs vendor", expect=0)
        self.f("cap-block", "C1", "no account", "--tried", "path A: vendor sandbox requested, refused without contract",
               "--tried", "path B: open-source equivalent evaluated, lacks required feature X", expect=0)
        r = self.f("gate", expect=0); self.assertIn("NOT built: C1", r.stdout)
        rep = self.f("report", expect=0); self.assertIn("path B", rep.stdout)


class TestHolds(Base):
    def test_open_hold_fails_gate_until_owner_resolves(self):
        self.green_capability()
        self.f("hold-add", "stop-condition", "touches real payment flow", "--owner", "billi", "--impact", "money moves", expect=0)
        self.assertEqual(self.f("gate").returncode, 2)
        self.assertNotEqual(self.f("hold-resolve", "H1", "--by", "builder-agent", "--decision", "fine").returncode, 0)
        self.assertNotEqual(self.f("hold-resolve", "H1", "--by", "someone-else", "--decision", "fine").returncode, 0)
        self.f("hold-resolve", "H1", "--by", "billi", "--decision", "use sandbox keys only", expect=0)
        self.assertEqual(self.f("gate").returncode, 0)

    def test_hold_requires_named_owner(self):
        self.assertNotEqual(forge("hold-add", "scope", "x", "-p", self.p).returncode, 0)


class TestAudit(Base):
    def test_builder_cannot_audit_itself(self):
        r = self.f("audit-set", "functional", "--status", "checked", "--by", "builder-agent",
                   "--note", "all fine here", "--evidence", "ran it")
        self.assertNotEqual(r.returncode, 0); self.assertIn("builder", r.stderr)

    def test_checked_needs_evidence_and_note(self):
        self.assertNotEqual(self.f("audit-set", "functional", "--status", "checked", "--by", "auditor", "--note", "looks fine to me").returncode, 0)
        self.assertNotEqual(self.f("audit-set", "functional", "--status", "inapplicable", "--by", "auditor", "--note", "x").returncode, 0)

    def test_partial_audit_is_labeled_and_blocks_audited_claim(self):
        self.green_capability()
        self.f("audit-set", "functional", "--status", "checked", "--by", "auditor", "--note", "slugify verified on 5 edge inputs", "--evidence", "tests/t1.py + manual run", expect=0)
        r = self.f("gate", expect=0)
        self.assertIn("PARTIAL (1/9)", r.stdout); self.assertIn("may not describe this as audited", r.stdout)

    def test_required_audit_fails_until_nine_and_complete_passes(self):
        t2 = tempfile.mkdtemp()
        try:
            forge("init", "strict", "--dir", t2, "--builder", "b", "--require-audit", expect=0)
            p = os.path.join(t2, "strict")
            forge("cap-add", "x", "-p", p, expect=0)
            (Path(p) / "tests/t.py").write_text("print('ok')\n")
            forge("cap-bind", "C1", "--file", "tests/t.py", "--cmd", "python3 tests/t.py", "-p", p, expect=0)
            self.assertEqual(forge("gate", "-p", p).returncode, 2)
            from importlib.machinery import SourceFileLoader
            cats = SourceFileLoader("forge_mod", FORGE).load_module().AUDIT_CATEGORIES
            for k in cats:
                forge("audit-set", k, "--status", "inapplicable", "--by", "auditor", "--note", f"{k} has no surface in this tiny tool", "-p", p, expect=0)
            r = forge("gate", "-p", p); self.assertEqual(r.returncode, 0, r.stdout); self.assertIn("COMPLETE (9/9)", r.stdout)
        finally:
            shutil.rmtree(t2, ignore_errors=True)

    def test_high_severity_finding_fails_gate(self):
        self.green_capability()
        self.f("audit-set", "security", "--status", "checked", "--by", "auditor", "--note", "admin route has no auth check",
               "--evidence", "build/app.py:41", "--severity", "high", expect=0)
        r = self.f("gate"); self.assertEqual(r.returncode, 2); self.assertIn("admin route", r.stdout)


@unittest.skipUnless(COMMON.exists(), "needs /usr/share/common-licenses")
class TestLicense(Base):
    def lic(self, text_or_path, name="LICENSE"):
        d = Path(tempfile.mkdtemp(prefix="lic-"))
        (d / name).write_text(Path(text_or_path).read_text() if isinstance(text_or_path, Path) else text_or_path)
        try:
            return json.loads(forge("license", str(d), expect=0).stdout)
        finally:
            shutil.rmtree(d, ignore_errors=True)

    def test_real_texts(self):
        cases = {"Apache-2.0": ("Apache-2.0", "ok"), "GPL-3": ("GPL-3.0", "restricted"), "GPL-2": ("GPL-2.0", "restricted"),
                 "LGPL-3": ("LGPL", "review"), "LGPL-2.1": ("LGPL", "review"), "MPL-2.0": ("MPL-2.0", "review")}
        for f, (name, verdict) in cases.items():
            r = self.lic(COMMON / f)
            self.assertEqual((r["license"], r["verdict"]), (name, verdict), f)

    def test_agpl_synthetic_title(self):
        r = self.lic("                    GNU AFFERO GENERAL PUBLIC LICENSE\n                       Version 3, 19 November 2007\n")
        self.assertEqual((r["license"], r["verdict"]), ("AGPL-3.0", "restricted"))

    def test_mit_and_bsd(self):
        mit = "MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy"
        self.assertEqual(self.lic(mit)["verdict"], "ok")
        bsd = "Redistribution and use in source and binary forms, with or without modification, are permitted"
        self.assertEqual(self.lic(bsd)["license"], "BSD")

    def test_no_license_and_unrecognized_are_blocked(self):
        d = Path(tempfile.mkdtemp()); (d / "main.py").write_text("print(1)")
        self.assertEqual(json.loads(forge("license", str(d), expect=0).stdout)["verdict"], "blocked")
        shutil.rmtree(d)
        self.assertEqual(self.lic("All rights reserved. Do not copy.")["verdict"], "blocked")

    def test_dual_license_takes_strictest_and_notes_it(self):
        d = Path(tempfile.mkdtemp())
        (d / "LICENSE").write_text("Permission is hereby granted, free of charge, to any person")
        (d / "ee").mkdir(); (d / "ee" / "LICENSE").write_text("GNU AFFERO GENERAL PUBLIC LICENSE Version 3")
        r = json.loads(forge("license", str(d), expect=0).stdout); shutil.rmtree(d)
        self.assertEqual(r["verdict"], "restricted"); self.assertIn("Multiple licenses", r["note"])

    def test_source_add_gate_and_owner_decision(self):
        self.green_capability()
        d = Path(tempfile.mkdtemp()); (d / "LICENSE").write_text(Path(COMMON / "GPL-3").read_text())
        self.f("source-add", "C1", str(d), "--taken", "slug helper", expect=0)
        r = self.f("gate"); self.assertEqual(r.returncode, 2); self.assertIn("without an owner decision", r.stdout)
        self.f("source-add", "C1", str(d), "--accept-risk", "billi: app will itself be GPL, accepted 2026-10-20", expect=0)
        # first (unaccepted) entry still present -> still fails; owner must remove or accept that entry
        self.assertEqual(self.f("gate").returncode, 2)
        shutil.rmtree(d)

    def test_deep_commercial_license_is_found(self):
        d = Path(tempfile.mkdtemp())
        (d / "LICENSE").write_text("Permission is hereby granted, free of charge, to any person")
        deep = d / "packages" / "features" / "ee"; deep.mkdir(parents=True)
        (deep / "LICENSE").write_text("GNU AFFERO GENERAL PUBLIC LICENSE Version 3")
        r = json.loads(forge("license", str(d), expect=0).stdout); shutil.rmtree(d)
        self.assertEqual(r["verdict"], "restricted"); self.assertEqual(len(r["files"]), 2)

    def test_source_remove_clears_gate_and_keeps_record(self):
        self.green_capability()
        d = Path(tempfile.mkdtemp()); (d / "LICENSE").write_text(Path(COMMON / "GPL-3").read_text())
        self.f("source-add", "C1", str(d), expect=0)
        self.assertEqual(self.f("gate").returncode, 2)
        self.assertNotEqual(self.f("source-remove", str(d)).returncode, 0)  # --reason required
        self.f("source-remove", str(d), "--reason", "GPL conflicts with app license", expect=0)
        self.assertEqual(self.f("gate").returncode, 0)
        rep = self.f("report", expect=0).stdout
        self.assertIn("considered and rejected", rep); self.assertIn("GPL conflicts", rep)
        shutil.rmtree(d)

    def test_source_update_corrects_taken(self):
        self.green_capability()
        d = Path(tempfile.mkdtemp()); (d / "LICENSE").write_text("Permission is hereby granted, free of charge, to any person")
        self.f("source-add", "C1", str(d), "--taken", "candidate", expect=0)
        self.f("source-update", str(d), "--taken", "design only, no code copied", expect=0)
        self.f("manifest", expect=0)
        self.assertIn("design only, no code copied", (Path(self.p) / "PROVENANCE.md").read_text())
        shutil.rmtree(d)

    def test_pycache_not_counted_as_prior_build_files(self):
        self.write("build/__pycache__/x.cpython-313.pyc", "x")
        self.f("cap-add", "x", expect=0); self.write("tests/t.py", "print(1)\n")
        r = self.f("cap-bind", "C1", "--file", "tests/t.py", "--cmd", "python3 tests/t.py", expect=0)
        self.assertNotIn("already in build/", r.stdout)

    def test_manifest_written(self):
        self.green_capability()
        d = Path(tempfile.mkdtemp()); (d / "LICENSE").write_text("Permission is hereby granted, free of charge, to any person")
        self.f("source-add", "C1", str(d), "--taken", "regex helper", expect=0)
        self.f("manifest", expect=0)
        txt = (Path(self.p) / "PROVENANCE.md").read_text()
        self.assertIn("MIT", txt); self.assertIn("regex helper", txt)
        shutil.rmtree(d)


class TestMutation(Base):
    def test_mutate_records_killed_survived_and_invalid(self):
        self.green_capability()
        self.f("gate", expect=0)
        muts = [
            {"name": "drops lowercasing", "file": "build/slug.py", "old": "s.lower().split()", "new": "s.split()"},
            {"name": "equivalent change", "file": "build/slug.py", "old": "'-'.join(", "new": "\"-\".join("},
            {"name": "stale pattern", "file": "build/slug.py", "old": "nonexistent text", "new": "x"},
        ]
        mf = Path(self.p) / "muts.json"; mf.write_text(json.dumps(muts))
        r = self.f("mutate", "--mutations", str(mf), expect=0)
        self.assertIn("killed    drops lowercasing", r.stdout)
        self.assertIn("SURVIVED  equivalent change", r.stdout)
        self.assertIn("INVALID   stale pattern", r.stdout)
        self.assertIn("1/3 killed", r.stdout)
        # original untouched
        self.assertIn("s.lower().split()", (Path(self.p) / "build/slug.py").read_text())
        g = self.f("gate", expect=0).stdout
        self.assertIn("survived every test", g); self.assertIn("did not apply", g)
        rep = self.f("report", expect=0).stdout
        status = [l for l in rep.splitlines() if l.startswith("**Status")][0]
        self.assertIn("test strength: 1/3 mutations killed", status)

    def test_unmeasured_strength_is_flagged(self):
        self.green_capability()
        g = self.f("gate", expect=0).stdout
        self.assertIn("no mutation check recorded", g)
        rep = self.f("report", expect=0).stdout
        self.assertIn("test strength unmeasured", [l for l in rep.splitlines() if l.startswith("**Status")][0])


class TestAuditSeverityInStatus(Base):
    def test_findings_by_severity_in_status_line(self):
        self.green_capability()
        for cat, sev in (("functional", "low"), ("errors", "medium"), ("security", "medium")):
            self.f("audit-set", cat, "--status", "checked", "--by", "auditor", "--note", f"finding in {cat} area",
                   "--evidence", "probe.py output", "--severity", sev, expect=0)
        rep = self.f("report", expect=0).stdout
        status = [l for l in rep.splitlines() if l.startswith("**Status")][0]
        self.assertIn("audit findings: 2 medium, 1 low", status)


class TestReport(Base):
    def test_status_line_carries_qualifiers_and_gaps_listed(self):
        self.green_capability()
        self.f("gap", "no public web page built", expect=0)
        r = self.f("report", expect=0).stdout
        status = [l for l in r.splitlines() if l.startswith("**Status")][0]
        self.assertIn("GATE PASSED", status); self.assertIn("audit PARTIAL (0/9)", status)
        self.assertIn("1 known gap(s) not built", status)
        self.assertIn("no public web page built", r)

    def test_report_not_done_then_done(self):
        self.f("cap-add", "x", expect=0)
        r = self.f("report"); self.assertEqual(r.returncode, 2); self.assertIn("Status: NOT DONE", r.stdout)
        self.assertIn("NOT AUDITED", r.stdout)
        shutil.rmtree(self.p); forge("init", "demo", "--dir", self.t, "--builder", "builder-agent", expect=0)
        self.green_capability()
        r = self.f("report"); self.assertEqual(r.returncode, 0, r.stdout); self.assertIn("Status: GATE PASSED", r.stdout)
        self.assertIn("PARTIAL (0/9)", r.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
