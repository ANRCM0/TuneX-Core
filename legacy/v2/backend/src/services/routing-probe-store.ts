import { redis } from "../redis.ts";
import { scopedKey } from "../tenant-scope.ts";
import { ROUTING_PROBE_LIMITS } from "../domain/routing/probe.ts";
import type { RoutingProbeStore } from "./routing-probe.ts";

/** Atomic reservation across Panel processes; one workspace job and a node cooldown. */
export const ROUTING_PROBE_ACQUIRE_LUA = `
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
redis.call('SET', KEYS[2], ARGV[1], 'PX', ARGV[3])
return 1`;
export const ROUTING_PROBE_RELEASE_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;
export const ROUTING_PROBE_WRITE_LUA = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])
return 1`;
export const routingProbeKeys = {
  busy: (workspace: number) => scopedKey(workspace, "routing_probe", "busy"),
  cooldown: (workspace: number, node: number) => scopedKey(workspace, "routing_probe", "cooldown", node),
  observation: (workspace: number, forward: number | string) => scopedKey(workspace, "routing_probe", "observation", forward),
};
export const routingProbeStore: RoutingProbeStore = {
  async acquire(workspace, node, token) {
    return await redis.eval(ROUTING_PROBE_ACQUIRE_LUA, 2, routingProbeKeys.busy(workspace), routingProbeKeys.cooldown(workspace, node),
      token, ROUTING_PROBE_LIMITS.reservation_ms, ROUTING_PROBE_LIMITS.node_cooldown_ms) === 1;
  },
  async release(workspace, token) {
    await redis.eval(ROUTING_PROBE_RELEASE_LUA, 1, routingProbeKeys.busy(workspace), token);
  },
  read: (workspace, forward) => redis.get(routingProbeKeys.observation(workspace, forward)),
  async write(workspace, forward, value, token) {
    return await redis.eval(ROUTING_PROBE_WRITE_LUA, 2, routingProbeKeys.busy(workspace), routingProbeKeys.observation(workspace, forward),
      token, value, ROUTING_PROBE_LIMITS.retention_ms) === 1;
  },
};
