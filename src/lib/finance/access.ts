import { actorCan, type ServerActor } from "@/lib/auth/server-actor";

export function canViewTaskFinance(actor: ServerActor) {
  return actor.isOwnerOrManager
    || actorCan(actor, "finance.view")
    || actorCan(actor, "finance.setPrice")
    || actorCan(actor, "finance.receivePayment");
}

export function canSetTaskPrice(actor: ServerActor) {
  return actor.isOwnerOrManager || actorCan(actor, "finance.setPrice");
}

export function canReceiveTaskPayment(actor: ServerActor) {
  return actor.isOwnerOrManager || actorCan(actor, "finance.receivePayment");
}

export function canVoidTaskPayment(actor: ServerActor) {
  return actor.isOwnerOrManager || actorCan(actor, "finance.voidPayment");
}
