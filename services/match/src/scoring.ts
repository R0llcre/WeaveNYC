import { randomUUID } from "node:crypto";

import type {
  MatchReason,
  MatchSuggestion,
  MatchablePost,
  MatchSuggestionBatch,
  PostSummary,
  ResourceSummary,
} from "./types.js";

type ScoredNeighbor = {
  candidate: MatchablePost;
  score: number;
  reasons: MatchReason[];
};

type ScoredResource = {
  candidate: ResourceSummary;
  score: number;
  reasons: MatchReason[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function distanceReason(distanceMiles: number | null): MatchReason | null {
  if (distanceMiles === null) {
    return null;
  }

  if (distanceMiles <= 1) {
    return "within_1_mile";
  }

  if (distanceMiles <= 3) {
    return "within_3_miles";
  }

  if (distanceMiles <= 5) {
    return "within_5_miles";
  }

  return null;
}

function distanceWeight(distanceMiles: number | null) {
  const reason = distanceReason(distanceMiles);
  if (reason === "within_1_mile") {
    return 1;
  }

  if (reason === "within_3_miles") {
    return 0.67;
  }

  if (reason === "within_5_miles") {
    return 0.34;
  }

  if (distanceMiles !== null) {
    return 0.05;
  }

  return 0;
}

function expiresSoon(isoTimestamp: string, now: Date) {
  const expiresAt = new Date(isoTimestamp).getTime();
  return expiresAt - now.getTime() <= 24 * 60 * 60 * 1000;
}

function freshnessWeight(isoTimestamp: string, now: Date) {
  return expiresSoon(isoTimestamp, now) ? 1 : 0;
}

function toPostSummary(post: MatchablePost, actorUserId: string): PostSummary {
  return {
    post_id: post.post_id,
    community_id: post.community_id,
    post_type: post.post_type,
    category: post.category,
    title: post.title,
    body: post.body,
    language: post.language,
    location_zip: post.location_zip,
    privacy: post.privacy,
    status: post.status,
    risk_level: post.risk_level,
    created_at: post.created_at,
    updated_at: post.updated_at,
    expires_at: post.expires_at,
    is_owner: post.created_by === actorUserId,
  };
}

export function scoreNeighborCandidates(requestPost: MatchablePost, candidates: MatchablePost[], now: Date) {
  return candidates
    .filter(
      (candidate) =>
        candidate.post_id !== requestPost.post_id &&
        candidate.post_type === "offer" &&
        candidate.status === "active" &&
        candidate.category === requestPost.category &&
        new Date(candidate.expires_at).getTime() > now.getTime(),
    )
    .map<ScoredNeighbor>((candidate) => {
      const reasons: MatchReason[] = ["same_category"];
      let score = 0;

      const distanceScore = distanceWeight(candidate.distance_miles);
      const distanceTag = distanceReason(candidate.distance_miles);
      if (distanceTag) {
        reasons.push(distanceTag);
      }
      score += distanceScore * 0.45;

      if (candidate.language === requestPost.language) {
        reasons.push("same_language");
        score += 0.2;
      }

      let trustScore = 0;
      if (candidate.author_level !== "anonymous") {
        reasons.push("verified_user");
        trustScore = 0.5;
      }

      if (candidate.anchor_reviewed) {
        reasons.push("anchor_reviewed");
        trustScore = 1;
      }
      score += trustScore * 0.2;

      if (freshnessWeight(candidate.expires_at, now) > 0) {
        reasons.push("expires_soon");
      }
      score += freshnessWeight(candidate.expires_at, now) * 0.15;

      return {
        candidate,
        score: clampScore(score),
        reasons,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftDistance = left.candidate.distance_miles ?? Number.POSITIVE_INFINITY;
      const rightDistance = right.candidate.distance_miles ?? Number.POSITIVE_INFINITY;
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return left.candidate.post_id.localeCompare(right.candidate.post_id);
    });
}

export function scoreOfficialResources(requestPost: MatchablePost, resources: ResourceSummary[]) {
  return resources
    .map<ScoredResource>((candidate) => {
      const reasons: MatchReason[] = ["nearby_resource"];
      let score = 0;

      score += distanceWeight(candidate.distance_miles) * 0.25;

      if (candidate.is_open_now) {
        reasons.push("open_now");
        score += 0.45;
      }

      if (!candidate.is_open_now && candidate.is_open_today) {
        reasons.push("open_today");
      }
      if (candidate.is_open_today) {
        score += 0.2;
      }

      if (candidate.languages.includes(requestPost.language)) {
        reasons.push("language_supported");
        score += 0.1;
      }

      return {
        candidate,
        score: clampScore(score),
        reasons,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftDistance = left.candidate.distance_miles ?? Number.POSITIVE_INFINITY;
      const rightDistance = right.candidate.distance_miles ?? Number.POSITIVE_INFINITY;
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return left.candidate.name.localeCompare(right.candidate.name);
    });
}

export function buildSuggestionBatch(input: {
  requestPost: MatchablePost;
  batchNumber: number;
  actorUserId: string;
  neighbors: MatchablePost[];
  resources: ResourceSummary[];
  now: Date;
  excludeCandidateKeys?: Set<string>;
}): MatchSuggestionBatch {
  const excluded = input.excludeCandidateKeys ?? new Set<string>();
  const scoredNeighbors = scoreNeighborCandidates(input.requestPost, input.neighbors, input.now).filter(
    (entry) => !excluded.has(`neighbor_post:${entry.candidate.post_id}`),
  );
  const scoredResources = scoreOfficialResources(input.requestPost, input.resources).filter(
    (entry) => !excluded.has(`official_resource:${entry.candidate.provider_id}`),
  );

  const picks: Array<
    | { kind: "neighbor_post"; value: ScoredNeighbor }
    | { kind: "official_resource"; value: ScoredResource }
  > = [];

  if (scoredResources.length === 0) {
    return {
      requestPostId: input.requestPost.post_id,
      batchNumber: input.batchNumber,
      createdAt: input.now.toISOString(),
      items: [],
    };
  }

  if (scoredNeighbors.length > 0) {
    const neighborPicks = scoredNeighbors.slice(0, 2);
    const primaryResource = scoredResources[0];
    for (const entry of neighborPicks) {
      picks.push({ kind: "neighbor_post", value: entry });
    }
    if (primaryResource) {
      picks.push({ kind: "official_resource", value: primaryResource });
    }

    const usedResourceIds = new Set(
      picks
        .filter((entry) => entry.kind === "official_resource")
        .map((entry) => entry.value.candidate.provider_id),
    );
    const usedNeighborIds = new Set(
      picks
        .filter((entry) => entry.kind === "neighbor_post")
        .map((entry) => entry.value.candidate.post_id),
    );

    for (const resource of scoredResources) {
      if (picks.length >= 3) {
        break;
      }
      if (usedResourceIds.has(resource.candidate.provider_id)) {
        continue;
      }
      picks.push({ kind: "official_resource", value: resource });
      usedResourceIds.add(resource.candidate.provider_id);
    }

    for (const neighbor of scoredNeighbors) {
      if (picks.length >= 3) {
        break;
      }
      if (usedNeighborIds.has(neighbor.candidate.post_id)) {
        continue;
      }
      picks.push({ kind: "neighbor_post", value: neighbor });
      usedNeighborIds.add(neighbor.candidate.post_id);
    }
  } else {
    for (const resource of scoredResources.slice(0, 3)) {
      picks.push({ kind: "official_resource", value: resource });
    }
  }

  const items: MatchSuggestion[] = picks.slice(0, 3).map((entry, index) => {
    if (entry.kind === "neighbor_post") {
      return {
        suggestion_id: randomUUID(),
        batch_number: input.batchNumber,
        position: index + 1,
        candidate_type: "neighbor_post",
        candidate_id: entry.value.candidate.post_id,
        score: entry.value.score,
        reasons: entry.value.reasons,
        distance_miles: entry.value.candidate.distance_miles,
        neighbor_post: toPostSummary(entry.value.candidate, input.actorUserId),
        official_resource: null,
      };
    }

    return {
      suggestion_id: randomUUID(),
      batch_number: input.batchNumber,
      position: index + 1,
      candidate_type: "official_resource",
      candidate_id: entry.value.candidate.provider_id,
      score: entry.value.score,
      reasons: entry.value.reasons,
      distance_miles: entry.value.candidate.distance_miles,
      neighbor_post: null,
      official_resource: entry.value.candidate,
    };
  });

  return {
    requestPostId: input.requestPost.post_id,
    batchNumber: input.batchNumber,
    createdAt: input.now.toISOString(),
    items,
  };
}
