import type { LucideIcon } from "lucide-react";
import { Sparkles, Star, Camera, Users, Trophy, MessageCircle, User as UserIcon, Waves } from "lucide-react";

export type InfoCardId =
  | "feed-overview"
  | "give-stars"
  | "share-ootd"
  | "waves-intro"
  | "daily-winner"
  | "comments"
  | "profile-card";

export interface InfoCardEntry {
  id: InfoCardId;
  icon: LucideIcon;
  /** i18n key for the title */
  titleKey: string;
  /** i18n key for the body copy */
  bodyKey: string;
  /** accent token: feeds the gradient/halo color */
  accent: "primary" | "accent" | "star" | "rose";
}

export const INFO_CARDS: Record<InfoCardId, InfoCardEntry> = {
  "feed-overview": {
    id: "feed-overview",
    icon: Sparkles,
    titleKey: "ootdInfoFeedTitle",
    bodyKey: "ootdInfoFeedBody",
    accent: "accent",
  },
  "give-stars": {
    id: "give-stars",
    icon: Star,
    titleKey: "ootdInfoStarsTitle",
    bodyKey: "ootdInfoStarsBody",
    accent: "star",
  },
  "share-ootd": {
    id: "share-ootd",
    icon: Camera,
    titleKey: "ootdInfoShareTitle",
    bodyKey: "ootdInfoShareBody",
    accent: "primary",
  },
  "waves-intro": {
    id: "waves-intro",
    icon: Waves,
    titleKey: "ootdInfoWavesTitle",
    bodyKey: "ootdInfoWavesBody",
    accent: "rose",
  },
  "daily-winner": {
    id: "daily-winner",
    icon: Trophy,
    titleKey: "ootdInfoWinnerTitle",
    bodyKey: "ootdInfoWinnerBody",
    accent: "star",
  },
  comments: {
    id: "comments",
    icon: MessageCircle,
    titleKey: "ootdInfoCommentsTitle",
    bodyKey: "ootdInfoCommentsBody",
    accent: "accent",
  },
  "profile-card": {
    id: "profile-card",
    icon: UserIcon,
    titleKey: "ootdInfoProfileTitle",
    bodyKey: "ootdInfoProfileBody",
    accent: "primary",
  },
};
