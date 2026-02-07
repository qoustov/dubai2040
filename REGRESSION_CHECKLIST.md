# Map Overlay Regression Checklist

1. Load the page and move the cursor quickly across adjacent polygons.
Expected: only one polygon is highlighted at any time, with no rapid flash.

2. Hover in and out of the same polygon repeatedly.
Expected: tooltip appears on hover and disappears fully on mouseout.

3. Sweep cursor across many polygons without pausing.
Expected: no stale tooltip labels remain on the map ("ghost" labels).

4. Move the cursor off the map container entirely.
Expected: highlight and tooltip state are fully cleared.

5. Zoom while a tooltip is visible.
Expected: tooltip closes during zoom; no detached label remains.

6. Toggle `Overlay` OFF while hovering a polygon.
Expected: polygons and masterplan image overlays both disappear with no stuck highlight/tooltip.

7. Toggle `Overlay` ON again and re-hover mapped and non-mapped projects.
Expected: interaction works identically after toggle restore.

8. Hover on polygons with masterplan images.
Expected: overlay image does not block pointer events; polygon hover still responds normally.
