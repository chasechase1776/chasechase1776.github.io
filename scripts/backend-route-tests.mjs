const DEFAULT_BASE_URL = "https://chasechase1776-github-io.vercel.app";
const baseUrl = (process.env.BACKEND_TEST_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

function url(path) {
  return `${baseUrl}${path}`;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Expected JSON but received: ${text.slice(0, 120)}`);
  }
}

async function expectJsonResponse(name, response, expectedStatus, expectedText) {
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(`${name}: expected HTTP ${expectedStatus}, received ${response.status}. ${body.slice(0, 160)}`);
  }

  const json = await readJson(response);
  const bodyText = JSON.stringify(json);
  if (expectedText && !bodyText.toLowerCase().includes(expectedText.toLowerCase())) {
    throw new Error(`${name}: expected response to mention "${expectedText}", received ${bodyText.slice(0, 180)}`);
  }

  return json;
}

test("health route reports app status", async () => {
  const response = await fetch(url("/api/health"), {
    headers: { "User-Agent": "bennett-homeschool-backend-route-test" }
  });
  const json = await expectJsonResponse("health route", response, 200);
  if (json.ok !== true) {
    throw new Error("health route: expected ok=true");
  }
});

test("activity save rejects duplicate subject time rows", async () => {
  const response = await fetch(url("/api/activities"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "bennett-homeschool-backend-route-test"
    },
    body: JSON.stringify({
      title: "Backend route validation test",
      date: "2026-08-01",
      actualMinutes: 30,
      activityType: "Math",
      narration: "This intentionally invalid request verifies that duplicate subject rows are rejected.",
      studentName: "Route Test Student",
      schoolYearLabel: "Route Test School Year",
      schoolYearStatus: "trial",
      parentApproved: true,
      subjectAllocations: [
        { subject: "Math", minutes: 15 },
        { subject: "Math", minutes: 15 }
      ],
      legalTags: [],
      skills: [],
      resources: [],
      artifactIds: []
    })
  });
  await expectJsonResponse("activity duplicate subject validation", response, 400, "only once");
});

test("upload route rejects missing proof file", async () => {
  const response = await fetch(url("/api/uploads"), {
    method: "POST",
    headers: { "User-Agent": "bennett-homeschool-backend-route-test" },
    body: new FormData()
  });
  await expectJsonResponse("upload missing file validation", response, 400, "file field");
});

test("daily summary PDF route rejects incomplete request", async () => {
  const response = await fetch(url("/api/daily-summary/pdf"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "bennett-homeschool-backend-route-test"
    },
    body: JSON.stringify({})
  });
  await expectJsonResponse("daily summary pdf validation", response, 400, "date");
});

test("weekly PDF route rejects incomplete request", async () => {
  const response = await fetch(url("/api/reviews/weekly/pdf"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "bennett-homeschool-backend-route-test"
    },
    body: JSON.stringify({})
  });
  await expectJsonResponse("weekly pdf validation", response, 400, "reviewId");
});

test("snapshot route rejects incomplete request", async () => {
  const response = await fetch(url("/api/snapshots"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "bennett-homeschool-backend-route-test"
    },
    body: JSON.stringify({})
  });
  await expectJsonResponse("snapshot validation", response, 400, "schoolYearLabel");
});

let failures = 0;

console.log(`Backend route checks against ${baseUrl}`);

for (const item of tests) {
  try {
    await item.run();
    console.log(`PASS ${item.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${item.name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

if (failures > 0) {
  console.error(`${failures} backend route check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}

console.log(`All ${tests.length} backend route checks passed.`);
