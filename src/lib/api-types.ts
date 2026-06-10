export type PairImage = {
  url: string;
  width: number;
  height: number;
  position: number;
};

export type PairCat = {
  id: string;
  name: string;
  slug: string;
  images: PairImage[];
};

export type PairResponse = {
  token: string;
  expiresAt: number; // epoch ms — the client drops queued pairs past this
  a: PairCat;
  b: PairCat;
};

export type PairBatchResponse = {
  pairs: PairResponse[];
};

export type VoteRequest = {
  token: string;
  winnerCatId: string;
  loserCatId: string;
};

export type RatingSide = {
  id: string;
  rating: number;
  rd: number;
  score: number;
};

export type VoteResponse = {
  ok: true;
  winner: RatingSide;
  loser: RatingSide;
};

export type ApiError = { error: string };
