export interface LayerIdentity {
  layerId: string;
  uuid: string;
  type?: string;
  name?: string;
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
  return UUID_V4_REGEX.test(id.trim());
}

export function isSymbolicRef(id: string): boolean {
  return id.startsWith('$');
}

export class IdentityResolver {
  private uuidToLayerId = new Map<string, string>();
  private layerIdToUuid = new Map<string, string>();
  private layerDetails = new Map<string, LayerIdentity>();

  register(identity: LayerIdentity) {
    if (identity.uuid) {
      this.uuidToLayerId.set(identity.uuid, identity.layerId);
      this.layerIdToUuid.set(identity.layerId, identity.uuid);
      this.layerDetails.set(identity.uuid, identity);
      this.layerDetails.set(identity.layerId, identity);
    }
  }

  resolveToLayerId(idOrUuid: string): string {
    const trimmed = idOrUuid.trim();
    if (isUuid(trimmed)) {
      const mapped = this.uuidToLayerId.get(trimmed);
      if (mapped) return mapped;
    }
    return trimmed;
  }

  resolveToUuid(idOrUuid: string): string | undefined {
    const trimmed = idOrUuid.trim();
    if (isUuid(trimmed)) {
      return trimmed;
    }
    return this.layerIdToUuid.get(trimmed);
  }

  getDetails(idOrUuid: string): LayerIdentity | undefined {
    return this.layerDetails.get(idOrUuid.trim());
  }

  invalidate(idOrUuid?: string) {
    if (idOrUuid) {
      const trimmed = idOrUuid.trim();
      const uuid = this.layerIdToUuid.get(trimmed) || (isUuid(trimmed) ? trimmed : undefined);
      const layerId = this.uuidToLayerId.get(trimmed) || (!isUuid(trimmed) ? trimmed : undefined);

      if (uuid) {
        this.uuidToLayerId.delete(uuid);
        this.layerDetails.delete(uuid);
      }
      if (layerId) {
        this.layerIdToUuid.delete(layerId);
        this.layerDetails.delete(layerId);
      }
    } else {
      this.uuidToLayerId.clear();
      this.layerIdToUuid.clear();
      this.layerDetails.clear();
    }
  }
}

export const identityResolver = new IdentityResolver();
