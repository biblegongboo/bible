#!/usr/bin/env python3
"""Authenticated browser smoke test for the deployed Bible application.

Credentials are read only from BIBLE_SMOKE_EMAIL/BIBLE_SMOKE_PASSWORD or
explicit command arguments. Never put a real user password in this script,
GitHub, or a report. Create a dedicated non-personal smoke-test account.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify deployed Bible UI paths with a dedicated smoke-test account.")
    parser.add_argument("--url", default=os.getenv("BIBLE_SMOKE_URL", "https://biblegongboo.github.io/bible/supabase/app/index.html"))
    parser.add_argument("--email", default=os.getenv("BIBLE_SMOKE_EMAIL", ""))
    parser.add_argument("--password", default=os.getenv("BIBLE_SMOKE_PASSWORD", ""))
    parser.add_argument("--headed", action="store_true", help="Show Chrome instead of using headless mode.")
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--report-dir", default="smoke-artifacts")
    return parser.parse_args()


def visible(driver: webdriver.Chrome, selector: str) -> bool:
    element = driver.find_element(By.CSS_SELECTOR, selector)
    return element.is_displayed() and element.get_attribute("hidden") is None


def main() -> int:
    args = parse_args()
    if not args.email or not args.password:
        print("BIBLE_SMOKE_EMAIL and BIBLE_SMOKE_PASSWORD are required (or pass --email / --password).", file=sys.stderr)
        return 2

    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    result = {"status": "passed", "url": args.url, "checks": [], "failures": []}
    options = Options()
    if not args.headed:
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,1200")
    options.add_argument("--disable-gpu")
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, args.timeout)

    def check(name: str, callback) -> None:
        callback()
        result["checks"].append(name)

    try:
        driver.get(args.url)
        # The app redirects unauthenticated users to login. Sign in and choose OT.
        if "login.html" in driver.current_url or driver.find_elements(By.ID, "loginEmail"):
            check("login page", lambda: wait.until(EC.visibility_of_element_located((By.ID, "loginEmail"))))
            driver.find_element(By.ID, "loginEmail").send_keys(args.email)
            driver.find_element(By.ID, "loginPassword").send_keys(args.password)
            driver.find_element(By.ID, "testLoginBtn").click()
            check("subject picker", lambda: wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#subjectList .subject-btn"))))
            driver.find_element(By.CSS_SELECTOR, "#subjectList .subject-btn").click()

        check("application shell", lambda: wait.until(EC.visibility_of_element_located((By.ID, "mainContainer"))))
        check("atlas button", lambda: wait.until(EC.element_to_be_clickable((By.ID, "bibleExploreToggle"))))
        check("people button", lambda: wait.until(EC.element_to_be_clickable((By.ID, "biblePeopleToggle"))))

        driver.find_element(By.ID, "biblePeopleToggle").click()
        check("people panel", lambda: wait.until(lambda d: visible(d, "#biblePeoplePanel")))
        search = driver.find_element(By.ID, "biblePeopleSearchInput")
        search.clear(); search.send_keys("Abraham", Keys.ENTER)
        check("Abraham detail", lambda: wait.until(lambda d: "Abraham" in d.find_element(By.ID, "biblePeopleDetail").text))
        check("Abraham context", lambda: wait.until(lambda d: "Sodom" in d.find_element(By.ID, "biblePeopleDetail").text))
        driver.find_element(By.ID, "biblePeopleClose").click()

        driver.find_element(By.ID, "bibleExploreToggle").click()
        check("atlas panel", lambda: wait.until(lambda d: visible(d, "#bibleExplorePanel")))
        place_search = driver.find_element(By.ID, "biblePlaceSearch")
        place_search.clear(); place_search.send_keys("Sodom")
        check("Sodom atlas detail", lambda: wait.until(lambda d: "Sodom" in d.find_element(By.ID, "biblePlaceDetail").text))

        for label, tab, required in [
            ("journeys", "journeys", "#bibleJourneySelector"),
            ("timeline", "timeline", "#bibleTimelineSelector"),
            ("early church", "patristic", "#biblePatristicResults"),
            ("study", "knowledge", "#bibleKnowledgeEntityResults"),
            ("library", "library", "#bibleLibraryResults"),
        ]:
            driver.find_element(By.CSS_SELECTOR, f'[data-bible-explore-tab="{tab}"]').click()
            check(label, lambda selector=required: wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector))))

        # Every visible Study sub-menu must load a representative result list.
        driver.find_element(By.CSS_SELECTOR, '[data-bible-explore-tab="knowledge"]').click()
        for label, section, result_id in [
            ("verse topics", "entities", "bibleKnowledgeEntityResults"),
            ("words", "words", "bibleWordResults"),
            ("dictionary", "dictionary", "bibleDictionaryResults"),
            ("topics", "topics", "bibleTopicResults"),
            ("books", "books", "bibleBookResults"),
        ]:
            driver.find_element(By.CSS_SELECTOR, f'[data-knowledge-section="{section}"]').click()
            check(f"study: {label}", lambda element_id=result_id: wait.until(lambda d: len(d.find_element(By.ID, element_id).find_elements(By.CSS_SELECTOR, "*")) > 0))

        # Every Library category must load at least one rendered source record.
        driver.find_element(By.CSS_SELECTOR, '[data-bible-explore-tab="library"]').click()
        for label, section in [
            ("commentary", "verse"),
            ("church fathers", "church-father-quotes"),
            ("dictionaries", "reference"),
            ("sermons", "sermon"),
            ("hymns", "hymn"),
            ("historical works", "historical-work"),
        ]:
            driver.find_element(By.CSS_SELECTOR, f'[data-library-section="{section}"]').click()
            check(f"library: {label}", lambda: wait.until(lambda d: len(d.find_element(By.ID, "bibleLibraryResults").find_elements(By.CSS_SELECTOR, "*")) > 0))

    except Exception as error:  # report a screenshot and DOM state without credentials
        result["status"] = "failed"
        result["failures"].append(str(error))
        driver.save_screenshot(str(report_dir / "bible-browser-smoke-failure.png"))
        (report_dir / "bible-browser-smoke-page.html").write_text(driver.page_source, encoding="utf-8")
    finally:
        result["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        (report_dir / "bible-browser-smoke-report.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        driver.quit()

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
