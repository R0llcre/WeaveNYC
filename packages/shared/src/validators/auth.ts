import { z } from "zod";

import { userLevels } from "../auth";

export const userLevelSchema = z.enum(userLevels);

export const sessionUserSchema = z.object({
  user_id: z.string().uuid(),
  level: userLevelSchema,
  role: z.enum(["user", "anchor"]),
  community_ids: z.array(z.string().uuid()),
});

export const anonymousAuthRequestSchema = z.object({
  device_id: z.string().uuid(),
});

export const anonymousAuthResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  user: sessionUserSchema.pick({
    user_id: true,
    level: true,
  }),
});

export const meResponseSchema = z.object({
  user: sessionUserSchema,
});

export const jwtClaimsSchema = z.object({
  sub: z.string().uuid(),
  level: userLevelSchema,
  role: z.enum(["user", "anchor"]),
  community_ids: z.array(z.string().uuid()),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
