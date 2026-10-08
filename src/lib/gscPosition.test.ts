import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateGscQueryRows,
  gscQueriesMatch,
  keywordTop20Rank,
  top20DisplayPosition,
} from "../../supabase/functions/_shared/gscPosition.ts";
import {
  ahrefsPositionsFromReports,
  betterDisplayRank,
  keywordDisplayPosition,
  mergeTrackedKeywordRows,
  trackedPhraseRank,
  trackedQueryPosition,
  visibleGscPosition,
} from "./gscPosition.ts";

test("top20DisplayPosition hides ranks outside the top 20 and blank zeros", () => {
  assert.equal(top20DisplayPosition(8.24), 8.2);
  assert.equal(top20DisplayPosition(20), 20);
  assert.equal(top20DisplayPosition(20.4), null);
  assert.equal(top20DisplayPosition(0), null);
  assert.equal(top20DisplayPosition(null), null);
  assert.equal(top20DisplayPosition(""), null);
});

test("keywordTop20Rank keeps a Search Console top-20 rank when Ahrefs is worse", () => {
  const rank = keywordTop20Rank({ position: 46, gsc_position: 7.2 });
  assert.deepEqual(rank, { position: 7.2, source: "gsc" });
});

test("keywordTop20Rank prefers the better Ahrefs rank inside the top 20", () => {
  const rank = keywordTop20Rank({ position: 4, gsc_position: 11 });
  assert.deepEqual(rank, { position: 4, source: "ahrefs" });
});

test("keywordTop20Rank reads a GSC-only row from its own position", () => {
  const rank = keywordTop20Rank({
    _source: "gsc",
    position: 3.5,
    gsc_position: 3.5,
  });
  assert.deepEqual(rank, { position: 3.5, source: "gsc" });
  assert.equal(keywordTop20Rank({ _source: "gsc", position: 28 }), null);
});

test("gscQueriesMatch is exact and does not treat a shorter query as the same phrase", () => {
  assert.equal(gscQueriesMatch("נופר זומר", "נופר זומר"), true);
  assert.equal(gscQueriesMatch("נופר זומר", "  נופר   זומר "), true);
  assert.equal(gscQueriesMatch("נופר זומר", "נופר"), false);
  assert.equal(gscQueriesMatch("נופר", "נופר זומר עורכת דין"), false);
});

test("aggregateGscQueryRows weights by impressions and ignores position 0", () => {
  const [row] = aggregateGscQueryRows([
    { query: "נופר זומר", clicks: 1, impressions: 2, position: 3 },
    { query: "נופר זומר", clicks: 0, impressions: 100, position: 0 },
    { query: "נופר זומר", clicks: 4, impressions: 8, position: 18 },
  ]);
  assert.equal(row.query, "נופר זומר");
  assert.equal(row.clicks, 5);
  assert.equal(row.impressions, 110);
  // (3*2 + 18*8) / 10 = 15, not pulled into the top by the zero-position day.
  assert.equal(row.position, 15);
});

test("aggregateGscQueryRows does not invent a top-20 rank from an unweighted average", () => {
  const [row] = aggregateGscQueryRows([
    { query: "ביטוי רעש", clicks: 0, impressions: 1, position: 2 },
    { query: "ביטוי רעש", clicks: 1, impressions: 1000, position: 48 },
  ]);
  assert.ok(row.position > 20);
  assert.equal(top20DisplayPosition(row.position), null);
});

test("visibleGscPosition blanks a rank the Top 20 list would hide", () => {
  assert.equal(visibleGscPosition("נופר זומר", 6.1), 6.1);
  assert.equal(visibleGscPosition("נופר זומר", 33), null);
  assert.equal(
    visibleGscPosition("בנק דיסקונט", 4, { tracked: ["נופר זומר עורכת דין"] }),
    null,
  );
  assert.equal(
    visibleGscPosition("נופר זומר", 4, {
      tracked: ["נופר זומר"],
      forceIrrelevant: ["נופר זומר"],
    }),
    null,
  );
  assert.equal(
    visibleGscPosition("עורך דין נופר זומר", 9, { tracked: ["נופר זומר"] }),
    9,
  );
});

test("tracked phrases keep a position outside the top 20 when they have Search Console data", () => {
  assert.equal(
    trackedQueryPosition("נופר זומר", 33.2, { tracked: ["נופר זומר"] }),
    33.2,
  );
  assert.equal(
    trackedQueryPosition("ביטוי אחר", 33, { tracked: ["נופר זומר"] }),
    null,
  );
  assert.equal(
    trackedQueryPosition("נופר זומר", 33, {
      tracked: ["נופר זומר"],
      forceIrrelevant: ["נופר זומר"],
    }),
    null,
  );
});

test("tracked phrases show the better rank from Ahrefs or Search Console", () => {
  assert.deepEqual(
    keywordDisplayPosition({ position: null, gsc_position: 27.4 }),
    { position: 27.4, source: "gsc" },
  );
  assert.deepEqual(keywordDisplayPosition({ position: 6, gsc_position: 27 }), {
    position: 6,
    source: "ahrefs",
  });
  assert.deepEqual(
    betterDisplayRank({ ahrefsPosition: 46, gscPosition: 7.2 }),
    { position: 7.2, source: "gsc" },
  );
  assert.deepEqual(keywordDisplayPosition({ position: 40, gsc_position: 33 }), {
    position: 33,
    source: "gsc",
  });
  assert.deepEqual(
    keywordDisplayPosition({
      position: 7,
      ahrefs_position: 46,
      gsc_position: 7,
      _position_source: "gsc",
    }),
    { position: 7, source: "gsc" },
  );
});

test("a tracked phrase on the Search Console list uses the better stored rank", () => {
  assert.deepEqual(
    trackedPhraseRank("נופר זומר", 33, {
      tracked: ["נופר זומר"],
      ahrefsPositions: { "נופר זומר": 14 },
    }),
    { position: 14, source: "ahrefs" },
  );
  assert.deepEqual(
    trackedPhraseRank("נופר זומר", null, {
      tracked: ["נופר זומר"],
      ahrefsPositions: { "נופר זומר": 14 },
    }),
    { position: 14, source: "ahrefs" },
  );
  assert.equal(
    trackedPhraseRank("ביטוי אחר", 33, {
      tracked: ["נופר זומר"],
      ahrefsPositions: { "נופר זומר": 14 },
    }),
    null,
  );
});

test("a later keyword list without ranks keeps the rank stored on an earlier report", () => {
  const merged = mergeTrackedKeywordRows(
    [{ keyword: "נופר זומר", position: 14, traffic: 8 }],
    [
      {
        keyword: "נופר זומר",
        position: null,
        traffic: 0,
        _source: "management-project-keywords",
      },
    ],
  );
  assert.equal(merged[0].position, 14);
  assert.equal(merged[0].traffic, 8);
  const positions = ahrefsPositionsFromReports([
    {
      report_data: {
        tracked_keywords: [{ keyword: "נופר זומר", position: null }],
      },
    },
    {
      report_data: {
        tracked_keywords: [{ keyword: "נופר זומר", position: 14 }],
      },
    },
  ]);
  assert.equal(positions.get("נופר זומר"), 14);
});
