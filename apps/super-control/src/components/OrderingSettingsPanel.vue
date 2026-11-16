<template>
  <section class="panel p-6">
    <div class="flex items-start gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-2xl bg-lime/40">
        <MapPin :size="18" />
      </span>
      <div>
        <h2 class="display m-0 text-xl font-extrabold">Order submission</h2>
        <p class="mb-0 mt-1 text-sm leading-6 text-black/55">
          Set where customers can submit QR orders and how many each device can place.
        </p>
      </div>
    </div>

    <form class="mt-5" @submit.prevent="save">
      <fieldset class="m-0 grid min-w-0 gap-4 border-0 p-0" :disabled="saving || locating">
        <div class="grid gap-3 sm:grid-cols-2">
          <label>
            <span class="label">Latitude</span>
            <input
              v-model="latitude"
              class="input"
              type="number"
              min="-90"
              max="90"
              step="any"
              :required="enableSubmitOrder || longitude !== ''"
            />
          </label>
          <label>
            <span class="label">Longitude</span>
            <input
              v-model="longitude"
              class="input"
              type="number"
              min="-180"
              max="180"
              step="any"
              :required="enableSubmitOrder || latitude !== ''"
            />
          </label>
        </div>
        <button type="button" class="btn-soft justify-self-start" @click="useCurrentLocation">
          <LoaderCircle v-if="locating" :size="16" class="animate-spin" />
          <LocateFixed v-else :size="16" />
          {{ locating ? "Getting location…" : "Use current location" }}
        </button>
        <label class="flex items-center gap-3 text-sm font-bold">
          <input v-model="enableSubmitOrder" class="size-4 accent-ink" type="checkbox" />
          Enable Submit order
        </label>
        <label v-if="enableSubmitOrder">
          <span class="label">Order radius (meters)</span>
          <input
            v-model="orderRadiusMeters"
            class="input"
            type="number"
            min="1"
            step="1"
            required
          />
          <span class="mt-2 block text-xs leading-5 text-black/55">
            Customers must share their location when they submit. The default radius is 100 m.
          </span>
        </label>
        <label>
          <span class="label">Hourly QR order limit per device</span>
          <input
            v-model="hourlyDeviceOrderLimit"
            class="input"
            type="number"
            min="0"
            max="999"
            step="1"
            required
          />
          <span class="mt-2 block text-xs leading-5 text-black/55">
            Maximum new QR orders per device in any 60-minute window. The default is 10.
            Enter 0 to disable the per-device limit.
          </span>
        </label>
        <p v-if="error" class="m-0 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700" role="alert">
          {{ error }}
        </p>
        <button type="submit" class="btn-primary w-full">
          <LoaderCircle v-if="saving" :size="16" class="animate-spin" />
          <Save v-else :size="16" />
          {{ saving ? "Saving…" : "Save order settings" }}
        </button>
      </fieldset>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { LoaderCircle, LocateFixed, MapPin, Save } from "lucide-vue-next";
import { api, type OrderingSettings } from "../api";
import { useSuperStore } from "../stores/super";
import { currentLocation } from "../utils/currentLocation";

const props = defineProps<{ business: OrderingSettings & { id: string } }>();
const emit = defineEmits<{ saved: [settings: OrderingSettings] }>();
const store = useSuperStore();
const latitude = ref<number | "">(props.business.latitude ?? "");
const longitude = ref<number | "">(props.business.longitude ?? "");
const enableSubmitOrder = ref(props.business.enableSubmitOrder);
const orderRadiusMeters = ref<number | "">(props.business.orderRadiusMeters);
const hourlyDeviceOrderLimit = ref<number | "">(props.business.hourlyDeviceOrderLimit);
const locating = ref(false);
const saving = ref(false);
const error = ref("");

async function useCurrentLocation() {
  if (locating.value || saving.value) return;
  error.value = "";
  locating.value = true;
  try {
    const coords = await currentLocation();
    latitude.value = coords.latitude;
    longitude.value = coords.longitude;
    store.notify("Location filled. Save order settings to apply it.");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    locating.value = false;
  }
}

async function save() {
  if (saving.value || locating.value) return;
  saving.value = true;
  error.value = "";
  try {
    const settings = await api<OrderingSettings>(
      `/api/super/businesses/${props.business.id}/ordering-settings`,
      {
        method: "PUT",
        body: JSON.stringify({
          latitude: latitude.value === "" ? null : latitude.value,
          longitude: longitude.value === "" ? null : longitude.value,
          enableSubmitOrder: enableSubmitOrder.value,
          orderRadiusMeters: enableSubmitOrder.value
            ? orderRadiusMeters.value
            : props.business.orderRadiusMeters,
          hourlyDeviceOrderLimit: hourlyDeviceOrderLimit.value,
        }),
      },
    );
    orderRadiusMeters.value = settings.orderRadiusMeters;
    hourlyDeviceOrderLimit.value = settings.hourlyDeviceOrderLimit;
    emit("saved", settings);
    store.notify("Order settings saved");
  } catch (value) {
    error.value = value instanceof Error ? value.message : "Could not save order settings";
  } finally {
    saving.value = false;
  }
}
</script>
