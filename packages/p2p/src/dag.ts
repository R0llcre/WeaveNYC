import { encode as encodeDagJson } from "@ipld/dag-json";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";

export const DAG_JSON_CODEC = 0x0129;

export type DagNode<T> = {
  cid: string;
  bytes: Uint8Array;
  value: T;
};

export async function encodeDagNode<T>(value: T): Promise<DagNode<T>> {
  const bytes = encodeDagJson(value);
  const digest = await sha256.digest(bytes);
  const cid = CID.createV1(DAG_JSON_CODEC, digest).toString();

  return {
    cid,
    bytes,
    value,
  };
}
