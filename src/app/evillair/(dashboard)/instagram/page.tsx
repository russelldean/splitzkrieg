'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface Photo {
  id: string;
  mediaUrl: string;
  caption: string | null;
  permalink: string;
  timestamp: string;
  parentId: string | null;
}

interface Pin {
  id: string;
  mediaUrl: string;
  caption: string | null;
  permalink: string;
}

export default function InstagramAdmin() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pins, setPins] = useState<(Pin | null)[]>([null, null, null, null, null, null]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);

  // Load current pins on mount
  useEffect(() => {
    async function loadPins() {
      try {
        const res = await fetch('/api/evillair/instagram/pins');
        if (res.ok) {
          const data = await res.json();
          const loaded = data.pins ?? [];
          setPins([loaded[0] ?? null, loaded[1] ?? null, loaded[2] ?? null, loaded[3] ?? null, loaded[4] ?? null, loaded[5] ?? null]);
        }
      } catch { /* ignore */ }
    }
    loadPins();
  }, []);

  const browsePhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/evillair/instagram/browse');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load photos');
      }
      const data = await res.json();
      setPhotos(data.photos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectPhoto = useCallback((photo: Photo) => {
    if (editingSlot === null) return;
    const pin: Pin = {
      id: photo.id,
      mediaUrl: photo.mediaUrl,
      caption: photo.caption,
      permalink: photo.permalink,
    };
    setPins(prev => {
      const next = [...prev];
      next[editingSlot] = pin;
      return next;
    });
    setEditingSlot(null);
    setSuccess(null);
  }, [editingSlot]);

  const clearSlot = useCallback((slot: number) => {
    setPins(prev => {
      const next = [...prev];
      next[slot] = null;
      return next;
    });
  }, []);

  const savePins = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const activePins = pins.filter((p): p is Pin => p !== null);
      const res = await fetch('/api/evillair/instagram/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pins: activePins }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setSuccess(`Saved ${activePins.length} pinned photo${activePins.length !== 1 ? 's' : ''}. Homepage will update shortly.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [pins]);

  const pinnedIds = new Set(pins.filter(Boolean).map(p => p!.id));

  return (
    <div>
      <h2 className="font-heading text-xl text-navy mb-4">Instagram Photos</h2>
      <p className="font-body text-sm text-navy/60 mb-6">
        Pick up to 6 photos to feature on the homepage. Click a slot, then pick a photo from your recent Instagram posts.
      </p>

      {/* Pinned slots */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-6">
        {pins.map((pin, i) => (
          <div key={i} className="flex flex-col gap-2">
            <span className="font-body text-xs text-navy/50 uppercase tracking-wide">
              #{i + 1}
            </span>
            {pin ? (
              <div
                className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-colors ${
                  editingSlot === i ? 'border-red-600' : 'border-navy/10 hover:border-navy/30'
                }`}
                onClick={() => setEditingSlot(editingSlot === i ? null : i)}
              >
                <Image
                  src={pin.mediaUrl}
                  alt={pin.caption?.slice(0, 60) || 'Pinned photo'}
                  fill
                  className="object-cover"
                  sizes="200px"
                  unoptimized
                />
                <button
                  onClick={(e) => { e.stopPropagation(); clearSlot(i); }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                >
                  &times;
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingSlot(i);
                  if (photos.length === 0) browsePhotos();
                }}
                className={`aspect-square rounded-lg border-2 border-dashed flex items-center justify-center font-body text-sm transition-colors ${
                  editingSlot === i
                    ? 'border-red-600 text-red-600'
                    : 'border-navy/20 text-navy/40 hover:border-navy/40 hover:text-navy/60'
                }`}
              >
                Pick photo
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={savePins}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-navy text-cream font-body text-sm font-semibold hover:bg-navy/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Pins'}
        </button>
        {success && <p className="font-body text-sm text-green-700">{success}</p>}
        {error && <p className="font-body text-sm text-red-600">{error}</p>}
      </div>

      {/* Photo browser */}
      {editingSlot !== null && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading text-lg text-navy">
              Pick a photo for slot #{editingSlot + 1}
            </h3>
            {photos.length === 0 ? (
              <button
                onClick={browsePhotos}
                disabled={loading}
                className="px-3 py-1.5 rounded-md bg-navy/10 text-navy font-body text-xs hover:bg-navy/20 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load Photos'}
              </button>
            ) : (
              <button
                onClick={browsePhotos}
                disabled={loading}
                className="px-3 py-1.5 rounded-md bg-navy/10 text-navy font-body text-xs hover:bg-navy/20 transition-colors disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
            </div>
          )}

          {!loading && photos.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => selectPhoto(photo)}
                  disabled={pinnedIds.has(photo.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                    pinnedIds.has(photo.id)
                      ? 'border-green-500 opacity-40 cursor-not-allowed'
                      : 'border-transparent hover:border-red-600 cursor-pointer'
                  }`}
                >
                  <Image
                    src={photo.mediaUrl}
                    alt={photo.caption?.slice(0, 60) || 'Instagram photo'}
                    fill
                    className="object-cover"
                    sizes="150px"
                    unoptimized
                  />
                  {pinnedIds.has(photo.id) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full font-body">
                        Pinned
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {!loading && photos.length === 0 && (
            <p className="font-body text-sm text-navy/50 py-4">
              Click "Load Photos" to browse your recent Instagram posts.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
