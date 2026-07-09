import { useId, useState } from "react";
import { Paperclip } from "lucide-react";
import type { PendingMediaAttachment } from "@/lib/domain/types";

const pendingMediaAcceptByKind: Record<PendingMediaAttachment["kind"], string> =
  {
    document: ".pdf,.doc,.docx,.txt,.rtf,application/pdf,text/plain",
    image: "image/*",
    audio: "audio/*",
    video: "video/*",
  };

function formatBytes(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function pendingMediaKindFromFile(
  file: File,
  fallback: PendingMediaAttachment["kind"]
) {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  return fallback;
}

export function PendingMediaSummary({
  items,
}: {
  items?: PendingMediaAttachment[];
}) {
  if (!items?.length) return null;
  return (
    <div
      className="platform-pending-media-list"
      aria-label="Pending media attachments"
    >
      {items.map(item => (
        <span key={item.id}>
          <Paperclip size={13} />
          {item.previewLabel}
          <small>Storage pending</small>
        </span>
      ))}
    </div>
  );
}

export default function PendingMediaField({
  value,
  onChange,
  kind,
  label,
  description,
}: {
  value: PendingMediaAttachment[];
  onChange: (items: PendingMediaAttachment[]) => void;
  kind: PendingMediaAttachment["kind"];
  label: string;
  description: string;
}) {
  const inputId = useId();
  const [error, setError] = useState("");
  const accept = pendingMediaAcceptByKind[kind];

  const addFiles = (files: FileList | null) => {
    setError("");
    if (!files?.length) return;
    const next: PendingMediaAttachment[] = [];
    Array.from(files)
      .slice(0, 3 - value.length)
      .forEach((file, index) => {
        if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
          setError("Each attachment must be 25 MB or smaller.");
          return;
        }
        const mediaKind = pendingMediaKindFromFile(file, kind);
        if (kind === "audio" && mediaKind !== "audio") {
          setError("Choose an audio file.");
          return;
        }
        if (kind === "video" && mediaKind !== "video") {
          setError("Choose a video file.");
          return;
        }
        next.push({
          id: `pending_${Date.now().toString(36)}_${index}_${file.name.replace(/[^a-z0-9]+/gi, "_").slice(0, 24)}`,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          kind: mediaKind,
          previewLabel: `${file.name} · ${formatBytes(file.size)}`,
          storageStatus: "pending_storage",
          createdAt: new Date().toISOString(),
        });
      });
    if (next.length) onChange([...value, ...next].slice(0, 3));
  };

  return (
    <div className="platform-pending-media-field">
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <label htmlFor={inputId}>
        <Paperclip size={15} />
        Choose file
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple
        onChange={event => {
          addFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      {error ? <p>{error}</p> : null}
      <div className="platform-pending-media-list">
        {value.map(item => (
          <span key={item.id}>
            <Paperclip size={13} />
            {item.previewLabel}
            <button
              type="button"
              aria-label={`Remove ${item.name}`}
              onClick={() =>
                onChange(value.filter(entry => entry.id !== item.id))
              }
            >
              Remove
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
