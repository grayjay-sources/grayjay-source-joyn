export interface JoynBlock {
  id: string;
  type: string;
  title?: string;
  assets?: JoynAsset[];
  lanes?: JoynLane[];
}

export interface JoynLane {
  id: string;
  title: string;
  assets: JoynAsset[];
  pagination?: {
    hasNextPage: boolean;
    endCursor?: string;
  };
}

export interface JoynAsset {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  contentType?: string;
  path?: string;
  publicationDate?: string;
  availableUntil?: string;
  images?: {
    heroLandscape?: string;
    heroPortrait?: string;
    artLogo?: string;
  };
  brand?: {
    id?: string;
    name?: string;
    logo?: string;
  };
}

export interface JoynLiveLane {
  channels: JoynLiveChannel[];
}

export interface JoynLiveChannel {
  id: string;
  name: string;
  path?: string;
  description?: string;
  images?: {
    logo?: string;
  };
  currentProgram?: {
    title?: string;
    startTime?: string;
    endTime?: string;
  };
}

