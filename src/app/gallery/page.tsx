"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type GalleryCategory = "All" | "Couple" | "Family" | "Fun" | "Details";

type GalleryItem = {
  src: string;
  alt: string;
  caption: string;
  category: Exclude<GalleryCategory, "All">;
  objectPosition?: string;
};

const GALLERY_CATEGORIES: readonly GalleryCategory[] = ["All", "Couple", "Family", "Fun", "Details"];

const GALLERY_ITEMS: readonly GalleryItem[] = [
  {
    src: "/images/gallery/tinginan.jpg",
    alt: "Red and Jess sharing a warm look together",
    caption: "From this look, everything felt right.",
    category: "Couple",
    objectPosition: "50% 26%",
  },
  {
    src: "/images/gallery/duo-hold-flower-1.jpg",
    alt: "Red and Jess holding flowers in a sweet portrait",
    caption: "Love in bloom, right from the start.",
    category: "Couple",
    objectPosition: "50% 26%",
  },
  {
    src: "/images/gallery/duo-hold-flower-2.jpg",
    alt: "Red and Jess holding flowers",
    caption: "A love story in full bloom.",
    category: "Couple",
    objectPosition: "50% 26%",
  },
  {
    src: "/images/gallery/duo-sit-9.jpg",
    alt: "Red and Jess seated portrait",
    caption: "Soft moments, strong forever.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/duo-hug-9.jpg",
    alt: "Red and Jess in a close embrace",
    caption: "Home is wherever we hold each other.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/tinginan-with-kuya.jpg",
    alt: "Red and Jess candid glance",
    caption: "Quiet sparks and smiles.",
    category: "Couple",
    objectPosition: "50% 26%",
  },
  {
    src: "/images/gallery/duo-closeup-1.jpg",
    alt: "Close-up portrait of Red and Jess",
    caption: "Close enough to hear each heartbeat.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/duo-closeup-2.jpg",
    alt: "Close-up portrait of Red and Jess together",
    caption: "Love in every glance.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/duo-closeup-3.jpg",
    alt: "Close-up portrait with a soft smile",
    caption: "A soft chapter in our forever story.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/duo-hug-2.jpg",
    alt: "Red and Jess smiling during a hug",
    caption: "Warm embrace, warm promises.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/duo-hug-4.jpg",
    alt: "Red and Jess sharing a tender hug",
    caption: "Wrapped in love and ease.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/duo-hug-6.jpg",
    alt: "Red and Jess in a candid hug",
    caption: "One hug says everything.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/duo-hug-7.jpg",
    alt: "Candid hugging moment of Red and Jess",
    caption: "Safe in each other's arms.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/duo-sit-7.jpg",
    alt: "Seated portrait of Red and Jess",
    caption: "Steady hearts, steady love.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/first-outing-1.jpg",
    alt: "Red and Jess during their first outing together",
    caption: "First outing, first of many memories.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/first-outing-2.jpg",
    alt: "Candid moment from Red and Jess first outing",
    caption: "Where our easy smiles began.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/first-outing-3.jpg",
    alt: "Red and Jess sharing a sweet first outing frame",
    caption: "A little moment that stayed with us.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/first-outing-4.jpg",
    alt: "Red and Jess portrait from their first outing day",
    caption: "From simple dates to forever plans.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/first-outing-5.jpg",
    alt: "First outing portrait of Red and Jess together",
    caption: "The day love felt even lighter.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/first-outing-6.jpg",
    alt: "Relaxed first outing shot of Red and Jess",
    caption: "Two hearts learning each other.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/first-outing-7.jpg",
    alt: "Playful pose from Red and Jess first outing",
    caption: "Still our favorite kind of fun.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/first-outing-9.jpg",
    alt: "Red and Jess captured in a first outing moment",
    caption: "A frame full of kilig.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/first-outing-10.jpg",
    alt: "Another memory from Red and Jess first outing together",
    caption: "One date, a lifetime of stories ahead.",
    category: "Couple",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/duo-with-shades-4.jpg",
    alt: "Red and Jess in playful shades portrait",
    caption: "Playful mood, forever vibe.",
    category: "Fun",
    objectPosition: "50% 25%",
  },
  {
    src: "/images/gallery/duo-with-shades-6.jpg",
    alt: "Red and Jess candid shot with shades",
    caption: "Chic, playful, and in love.",
    category: "Fun",
    objectPosition: "50% 25%",
  },
  {
    src: "/images/gallery/duo-with-shades-8.jpg",
    alt: "Red and Jess wearing sunglasses",
    caption: "Cool together, forever together.",
    category: "Fun",
    objectPosition: "50% 26%",
  },
  {
    src: "/images/gallery/kiss-kuya.jpg",
    alt: "Playful close-up of Red and Jess",
    caption: "Playful love, everyday joy.",
    category: "Fun",
    objectPosition: "50% 25%",
  },
  {
    src: "/images/gallery/trio-kulitan-1.jpg",
    alt: "Red and Jess sharing laughter with family",
    caption: "Laughter is part of our vows too.",
    category: "Family",
    objectPosition: "50% 25%",
  },
  {
    src: "/images/gallery/first-outing-with-kuya-1.jpg",
    alt: "Red and Jess with Kuya during their first outing",
    caption: "First outing memory with Kuya by our side.",
    category: "Family",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/family-of-4.jpg",
    alt: "Family of four portrait with Red and Jess",
    caption: "A precious family memory we hold close.",
    category: "Family",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/trio-smile-1.jpg",
    alt: "Red and Jess smiling with family",
    caption: "Love that grows as a family.",
    category: "Family",
    objectPosition: "50% 26%",
  },
  {
    src: "/images/gallery/trio-smile-2.jpg",
    alt: "Smiling family portrait",
    caption: "Joy that multiplies.",
    category: "Family",
    objectPosition: "50% 26%",
  },
  {
    src: "/images/gallery/trio-smile-3.jpg",
    alt: "Family portrait with bright smiles",
    caption: "Together is our favorite place.",
    category: "Family",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/trio-smile-4.jpg",
    alt: "Warm smiling family portrait with Red and Jess",
    caption: "Smiles shared, memories kept forever.",
    category: "Family",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/trio-sit-hug-4.jpg",
    alt: "Family seated portrait with warm hug",
    caption: "Three hearts, one beautiful story.",
    category: "Family",
    objectPosition: "50% 28%",
  },
  {
    src: "/images/gallery/trio-sit-hug-6.jpg",
    alt: "Seated family hug portrait",
    caption: "Family moments that stay in the heart.",
    category: "Family",
    objectPosition: "50% 28%",
  },
  {
    src: "/images/gallery/groom-to-be-1.jpg",
    alt: "Red portrait with groom sash",
    caption: "Future husband energy.",
    category: "Fun",
    objectPosition: "50% 26%",
  },
  {
    src: "/images/gallery/groom-to-be-2.jpg",
    alt: "Red portrait with groom look",
    caption: "Calm, confident, and ready for forever.",
    category: "Fun",
    objectPosition: "50% 26%",
  },
  {
    src: "/images/gallery/bride-harap-2.jpg",
    alt: "Jess bridal portrait with a gentle smile",
    caption: "Grace that glows in every frame.",
    category: "Fun",
    objectPosition: "50% 26%",
  },
  {
    src: "/images/gallery/bride-harap-3.jpg",
    alt: "Jess portrait with bridal bouquet",
    caption: "Radiant bride-to-be.",
    category: "Fun",
    objectPosition: "50% 26%",
  },
  {
    src: "/images/gallery/hands-1.jpg",
    alt: "Close-up of Red and Jess hands",
    caption: "A promise you can hold.",
    category: "Details",
    objectPosition: "50% 50%",
  },
  {
    src: "/images/gallery/hands-2.jpg",
    alt: "Red and Jess holding hands",
    caption: "Hand in hand, always.",
    category: "Details",
    objectPosition: "50% 50%",
  },
];

export default function GalleryPage() {
  const [activeCategory, setActiveCategory] = useState<GalleryCategory>("All");
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  const filteredPhotos = useMemo(() => {
    if (activeCategory === "All") return GALLERY_ITEMS;
    return GALLERY_ITEMS.filter((photo) => photo.category === activeCategory);
  }, [activeCategory]);

  const activePhoto = activePhotoIndex !== null ? filteredPhotos[activePhotoIndex] ?? null : null;

  useEffect(() => {
    if (activePhotoIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePhotoIndex(null);
        return;
      }

      if (event.key === "ArrowLeft") {
        setActivePhotoIndex((current) => {
          if (current === null) return current;
          return (current - 1 + filteredPhotos.length) % filteredPhotos.length;
        });
      }

      if (event.key === "ArrowRight") {
        setActivePhotoIndex((current) => {
          if (current === null) return current;
          return (current + 1) % filteredPhotos.length;
        });
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activePhotoIndex, filteredPhotos.length]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">Red & Jess</p>
            <h1 className="mt-2 font-display text-4xl text-[var(--ink-deep)] sm:text-5xl">Full Gallery</h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Every smile, every laugh, every frame of our story.
            </p>
          </div>
          <Link
            href="/#gallery"
            className="inline-flex items-center rounded-full border border-[var(--sand)] bg-[var(--cream)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-deep)]"
          >
            Back to RSVP Page
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {GALLERY_CATEGORIES.map((category) => {
            const isActive = category === activeCategory;
            return (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setActiveCategory(category);
                  setActivePhotoIndex(null);
                }}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition ${
                  isActive
                    ? "bg-[var(--ink-deep)] text-[var(--cream)]"
                    : "border border-[var(--sand)] bg-[var(--cream)] text-[var(--ink-soft)] hover:text-[var(--ink-deep)]"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPhotos.map((photo, index) => (
            <button
              key={photo.src}
              type="button"
              onClick={() => setActivePhotoIndex(index)}
              className="group relative h-[250px] overflow-hidden rounded-2xl border border-[var(--sand)] bg-[var(--cream)] text-left"
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover object-center transition duration-500 group-hover:scale-[1.03]"
                style={{ objectPosition: photo.objectPosition ?? "50% 25%" }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8">
                <p className="text-xs uppercase tracking-[0.13em] text-[var(--cream)]/95">{photo.caption}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {activePhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-md"
          onClick={() => setActivePhotoIndex(null)}
        >
          <div
            className="group relative"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden rounded-2xl border border-white/35 bg-black/30 shadow-2xl">
              <Image
                src={activePhoto.src}
                alt={activePhoto.alt}
                width={1600}
                height={1067}
                sizes="92vw"
                priority
                className="block max-h-[80vh] w-auto max-w-[92vw] object-contain"
              />
              <div className="absolute left-3 top-3 max-w-[78%] sm:left-4 sm:top-4">
                <p className="font-display text-lg italic leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)] sm:text-xl">
                  {activePhoto.caption}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActivePhotoIndex(null)}
              className="absolute right-3 top-3 rounded-full border border-white/30 bg-black/35 p-2 text-[var(--cream)] backdrop-blur-md transition hover:bg-black/55 sm:right-4 sm:top-4"
              aria-label="Close photo preview"
            >
              <span aria-hidden="true" className="block text-base leading-none">
                ×
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActivePhotoIndex((current) => {
                  if (current === null) return current;
                  return (current - 1 + filteredPhotos.length) % filteredPhotos.length;
                })
              }
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/30 p-2 text-[var(--cream)] opacity-0 backdrop-blur-md transition duration-200 hover:bg-black/50 group-hover:opacity-60 focus-visible:opacity-100 sm:left-4"
              aria-label="Show previous photo"
            >
              <span aria-hidden="true" className="block text-2xl leading-none">
                &#8249;
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActivePhotoIndex((current) => {
                  if (current === null) return current;
                  return (current + 1) % filteredPhotos.length;
                })
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/30 p-2 text-[var(--cream)] opacity-0 backdrop-blur-md transition duration-200 hover:bg-black/50 group-hover:opacity-60 focus-visible:opacity-100 sm:right-4"
              aria-label="Show next photo"
            >
              <span aria-hidden="true" className="block text-2xl leading-none">
                &#8250;
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
