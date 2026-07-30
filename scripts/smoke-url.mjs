const targetUrl = process.argv[2];

if (!targetUrl) {
  console.error("Usage: node scripts/smoke-url.mjs <url>");
  process.exit(1);
}

const requiredText = ["Bennett Homeschool"];

try {
  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": "bennett-homeschool-smoke-test"
    }
  });

  if (!response.ok) {
    throw new Error(`Expected HTTP 200 but received ${response.status}`);
  }

  const body = await response.text();
  const missingText = requiredText.filter((text) => !body.includes(text));

  if (missingText.length > 0) {
    throw new Error(`Missing expected page text: ${missingText.join(", ")}`);
  }

  console.log(`Smoke check passed: ${targetUrl}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Smoke check failed.");
  process.exit(1);
}
