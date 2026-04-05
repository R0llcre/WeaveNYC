export type UserLevel = 'anonymous' | 'verified' | 'anchor';

export type AnonymousUser = {
  user_id: string;
  level: UserLevel;
};

export type AnonymousSessionResponse = {
  access_token: string;
  refresh_token: string;
  user: AnonymousUser;
};

export type EndpointProbe = {
  endpoint: '/healthz' | '/readyz';
  ok: boolean;
  statusCode: number | null;
  detail: string;
};
