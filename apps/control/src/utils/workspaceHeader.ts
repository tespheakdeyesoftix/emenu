import type { InjectionKey, Ref } from "vue";

export const workspaceActionsDisabled: InjectionKey<Readonly<Ref<boolean>>> =
  Symbol("workspaceActionsDisabled");
