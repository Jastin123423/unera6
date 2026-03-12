export type PostActionType = "edit" | "delete" | "share" | "report";

export type PostItemType =
  | "post"
  | "reel"
  | "group_post"
  | "event"
  | "product";

type ActionHandler = (payload: any) => Promise<any> | void;

type ActionMap = {
  [type in PostItemType]?: {
    [action in PostActionType]?: ActionHandler;
  };
};

const registry: ActionMap = {};

export const registerPostActions = (
  type: PostItemType,
  actions: Partial<Record<PostActionType, ActionHandler>>
) => {
  registry[type] = {
    ...(registry[type] || {}),
    ...actions,
  };
};

export const performPostAction = async (
  type: PostItemType,
  action: PostActionType,
  payload: any
) => {
  const handler = registry[type]?.[action];

  if (!handler) {
    console.warn(`No handler for ${type}:${action}`);
    return;
  }

  return handler(payload);
};
