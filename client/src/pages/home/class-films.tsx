import { useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import type { LandingCopy } from "./landing-copy";

/**
 * Nile Center's own films from its YouTube channel (NileCenterArabic):
 * "Discover the Life of Nile Learning Center since 1998" and "Stop Searching.
 * Start Learning Arabic & Quran". The posters are the films' own thumbnails,
 * served from this site, so nothing loads from YouTube until a visitor
 * presses play, and then only from the privacy-enhanced domain.
 */
const FILMS = {
  life: { id: "OC5b0NDBqeM", poster: "/home/films/life" },
  start: { id: "uuuZq9CDtBk", poster: "/home/films/start" },
} as const;

type Film = keyof typeof FILMS;

export function ClassFilms({ copy }: { copy: LandingCopy["films"] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [film, setFilm] = useState<Film | null>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (film && !node.open) node.showModal();
    if (!film && node.open) node.close();
  }, [film]);

  return (
    <div className="lh-films">
      {(["life", "start"] as const).map(kind => (
        <button
          key={kind}
          type="button"
          className="lh-film"
          data-kind={kind}
          onClick={() => setFilm(kind)}
          aria-label={`${copy.play}: ${copy[kind].title}`}
        >
          <span className="lh-film-art" aria-hidden="true">
            <img
              src={`${FILMS[kind].poster}-640.webp`}
              srcSet={`${FILMS[kind].poster}-640.webp 640w, ${FILMS[kind].poster}-1280.webp 1280w`}
              sizes="(max-width: 640px) 100vw, (max-width: 1099px) 50vw, 36rem"
              width={1280}
              height={720}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </span>
          <span className="lh-film-play" aria-hidden="true">
            <Play />
          </span>
          <span className="lh-film-text">
            <strong>{copy[kind].title}</strong>
            <small>{copy[kind].note}</small>
          </span>
        </button>
      ))}
      <p className="lh-films-source">{copy.source}</p>

      <dialog
        ref={dialog}
        className="lh-film-dialog"
        aria-label={film ? copy[film].title : copy.title}
        onClose={() => setFilm(null)}
        onClick={event => {
          // A click on the backdrop (the dialog box itself, outside the frame) closes it.
          if (event.target === event.currentTarget) setFilm(null);
        }}
      >
        {/* First in order, so the dialog focuses it rather than the player and Escape closes the film. */}
        <button
          type="button"
          className="lh-film-close"
          onClick={() => setFilm(null)}
          aria-label={copy.close}
        >
          <X aria-hidden="true" />
        </button>
        {film ? (
          <div className="lh-film-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${FILMS[film].id}?autoplay=1&rel=0&modestbranding=1`}
              title={copy[film].title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
