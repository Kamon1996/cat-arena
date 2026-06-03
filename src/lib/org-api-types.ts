export type CreateOrgRequest = {
  name: string;
  description?: string;
  logoR2Key?: string;
};

export type CreateOrgResponse = {
  id: string;
  slug: string;
  joinCode: string;
};

export type JoinOrgRequest = {
  joinCode: string;
};

export type JoinOrgResponse = {
  ok: true;
  orgId: string;
  orgSlug: string;
};

export type LeaveOrgRequest = {
  orgId: string;
};

export type LeaveOrgResponse = {
  ok: true;
};
