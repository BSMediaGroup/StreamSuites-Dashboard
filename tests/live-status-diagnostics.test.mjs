import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("Kick platform page renders Runtime/Auth live-status diagnostics controls", () => {
  const view = read("docs/views/platforms/kick.html");
  const script = read("docs/js/platforms/kick.js");
  assert.match(view, /id="kick-live-status-refresh"/);
  assert.match(view, /id="kick-live-status-scan"/);
  assert.match(view, /id="kick-live-status-rows"/);
  assert.match(script, /\/api\/admin\/live-status\/diagnostics\?platform=kick/);
  assert.match(script, /\/api\/admin\/live-status\/scan/);
  assert.match(script, /JSON\.stringify\(\{ platform: "kick" \}\)/);
  assert.match(script, /next_allowed_check_at/);
  assert.match(script, /recent_stream_count/);
});

test("YouTube and Twitch platform pages show scaffolded disabled live-fetch controls", () => {
  const youtubeView = read("docs/views/platforms/youtube.html");
  const youtubeScript = read("docs/js/platforms/youtube.js");
  const twitchView = read("docs/views/platforms/twitch.html");
  const twitchScript = read("docs/js/platforms/twitch.js");
  assert.match(youtubeView, /id="yt-live-status-scan"[\s\S]*disabled/);
  assert.match(twitchView, /id="tw-live-status-scan"[\s\S]*disabled/);
  assert.match(youtubeScript, /platform=youtube/);
  assert.match(twitchScript, /platform=twitch/);
  assert.match(youtubeScript, /Not implemented/);
  assert.match(twitchScript, /Not implemented/);
});

test("Rumble diagnostics view remains present and script load order keeps platform scripts", () => {
  const rumbleView = read("docs/views/platforms/rumble.html");
  const index = read("docs/index.html");
  assert.match(rumbleView, /rumble-intelligence-diagnostics/);
  assert.match(index, /js\/platforms\/rumble\.js[\s\S]*js\/platforms\/youtube\.js[\s\S]*js\/platforms\/twitch\.js[\s\S]*js\/platforms\/discord\.js[\s\S]*js\/platforms\/kick\.js/);
});
