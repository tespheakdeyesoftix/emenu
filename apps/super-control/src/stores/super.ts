import { defineStore } from "pinia";
import { api, type SessionIdentity } from "../api";

export const useSuperStore = defineStore("super", {
  state: () => ({
    identity: null as SessionIdentity | null,
    identityLoading: false,
    toast: "",
  }),
  actions: {
    async loadIdentity() {
      if (this.identity || this.identityLoading) return;
      this.identityLoading = true;
      try {
        this.identity = await api<SessionIdentity>("/api/super/session");
      } finally {
        this.identityLoading = false;
      }
    },
    notify(message: string) {
      this.toast = message;
      window.setTimeout(() => {
        this.toast = "";
      }, 2600);
    },
    signOut() {
      location.assign(
        `/cdn-cgi/access/logout?returnTo=${encodeURIComponent(location.origin)}`,
      );
    },
  },
});
