---
name: 2d-game-development
description: "Develop 2D games using modern frameworks and engines including Godot, Phaser, Unity 2D, and LÖVE. Use for: creating 2D platformers, top-down games, side-scrollers, puzzle games, implementing sprite animation and tilemap systems, designing 2D physics and collision detection, building 2D UI and HUD elements, optimizing 2D rendering performance, deploying to web/mobile/desktop platforms, and developing games with pixel art, vector graphics, or hand-drawn aesthetics."
---

# 2D Game Development

Create engaging 2D games using modern frameworks, engines, and development techniques.

## Overview

2D game development combines art, programming, and design to create games in two-dimensional space. This skill covers popular 2D engines and frameworks (Godot, Phaser, Unity 2D, LÖVE, Cocos2d-x), sprite-based rendering and animation, tilemap systems, 2D physics engines, optimization techniques, and cross-platform deployment. 2D games remain popular across all platforms, from mobile hits to indie darlings on Steam.

## Framework and Engine Selection

### Comparison of 2D Engines

| Engine/Framework | Language | Best For | Platforms | Learning Curve |
|------------------|----------|----------|-----------|----------------|
| **Godot** | GDScript, C# | All 2D games, open-source projects | Desktop, mobile, web | Medium |
| **Unity 2D** | C# | Cross-platform, mobile games | All platforms | Medium-High |
| **Phaser** | JavaScript | Browser games, HTML5 | Web, mobile (Cordova) | Low-Medium |
| **LÖVE** | Lua | Rapid prototyping, indie games | Desktop, mobile | Low |
| **Cocos2d-x** | C++, Lua, JS | Mobile games, performance-critical | Mobile, desktop | Medium-High |
| **GameMaker** | GML | Beginners, rapid development | Desktop, mobile, console | Low |
| **Construct** | Visual | No-code development | Web, mobile | Very Low |

### Godot Engine (Recommended for Most Projects)

**Advantages:**
- Dedicated 2D engine (not 3D adapted for 2D)
- Real 2D pixel coordinates
- Lightweight and fast
- Open-source and free (MIT license)
- Node-based scene system
- Built-in animation tools
- Excellent documentation

**Use Cases:**
- Platformers (Celeste-style)
- Top-down RPGs
- Puzzle games
- Metroidvanias
- Visual novels

**Getting Started:**
1. Download from godotengine.org
2. Create new 2D project
3. Learn node system (Node2D, Sprite, AnimatedSprite, TileMap)
4. GDScript basics (Python-like syntax)
5. Build first platformer following official tutorial

### Phaser (Best for Web Games)

**Advantages:**
- JavaScript-based (web developer friendly)
- Runs in browser (no installation)
- Large community and plugins
- Good for HTML5 games
- Free and open-source

**Use Cases:**
- Browser games
- Educational games
- Casual mobile games (via Cordova)
- Rapid prototypes

**Getting Started:**
1. Include Phaser via CDN or npm
2. Create game config and scenes
3. Load assets (images, spritesheets)
4. Implement game logic with Phaser API
5. Deploy to web hosting

### Unity 2D

**Advantages:**
- Powerful cross-platform support
- Massive asset store
- C# programming (industry standard)
- Strong mobile deployment
- Professional tooling

**Use Cases:**
- Mobile games (iOS, Android)
- Multi-platform releases
- Games requiring 3D elements in 2D space
- Commercial projects

**Getting Started:**
1. Install Unity Hub and Unity Editor
2. Create 2D project template
3. Learn Sprite Renderer, Tilemap, 2D Physics
4. C# scripting for game logic
5. Build for target platforms

## Sprite-Based Rendering

### Sprite Sheets and Atlases

**Sprite Sheet:**
Single image containing multiple frames or sprites.

**Benefits:**
- Reduces draw calls (one texture for many sprites)
- Faster loading (one file vs. many)
- Easier asset management
- Better performance

**Tools:**
- TexturePacker (paid, professional)
- Shoebox (free, simple)
- Aseprite (pixel art + export)
- Godot/Unity built-in tools

**Best Practices:**
- Power-of-2 dimensions (512x512, 1024x1024, 2048x2048)
- Leave 1-2 pixel padding between sprites (prevents bleeding)
- Group related sprites (character animations, UI elements)
- Use PNG with transparency

### Sprite Animation

**Frame-Based Animation:**
Sequence of images played in order (like flipbook).

**Implementation Approaches:**

**Manual Frame Switching:**
```python
# Pseudocode
current_frame = 0
frame_duration = 0.1  # seconds
time_elapsed = 0

func update(delta):
    time_elapsed += delta
    if time_elapsed >= frame_duration:
        current_frame = (current_frame + 1) % total_frames
        sprite.texture = frames[current_frame]
        time_elapsed = 0
```

**Engine-Provided Animation:**
- Godot: AnimatedSprite node
- Unity: Animator with 2D sprite animation
- Phaser: Animation manager

**Animation States:**
- Idle, Walk, Run, Jump, Attack, Hurt, Death
- Transition logic between states
- Blend or snap transitions

### Pixel Art Considerations

**Pixel-Perfect Rendering:**
- Disable texture filtering (use "Nearest" not "Linear")
- Use integer positions for sprites
- Camera zoom in integer multiples (2x, 3x, 4x)
- Match game resolution to pixel art scale

**Common Resolutions:**
- 320x180 (16:9, very low-res)
- 640x360 (16:9, low-res)
- 1280x720 (16:9, medium)
- Native resolution with integer scaling

## Tilemap Systems

### Tilemap Basics

**Tilemap:**
Grid-based level layout using reusable tile images.

**Advantages:**
- Memory efficient (reuse tiles)
- Easy level editing
- Fast rendering (batched draw calls)
- Collision detection simplified

**Tile Types:**
- **Terrain:** Ground, walls, platforms
- **Decorative:** Background details, foliage
- **Interactive:** Doors, switches, collectibles
- **Collision:** Invisible tiles defining solid areas

### Tilemap Editors

| Tool | Type | Best For |
|------|------|----------|
| **Tiled** | Standalone | Universal, exports to many formats |
| **Godot TileMap** | Built-in | Godot projects |
| **Unity Tilemap** | Built-in | Unity projects |
| **LDtk** | Standalone | Modern, level design focused |

### Tileset Design

**Tile Size:**
- Common: 16x16, 32x32, 64x64 pixels
- Consistent size across tileset
- Match game's pixel art scale

**Autotiling:**
Automatically select correct tile based on neighbors.

**Tile Variations:**
- Multiple versions of same tile (grass with flowers, plain grass)
- Randomization for visual variety
- Animated tiles (water, lava, torches)

## 2D Physics and Collision

### Physics Engines

**Box2D:**
- Industry standard for 2D physics
- Used by many engines (Unity, Godot, Cocos2d-x)
- Realistic physics simulation
- Rigid body dynamics

**Arcade Physics:**
- Simpler, game-focused physics
- No rotation, simplified collision
- Faster performance
- Good for platformers, top-down games

### Collision Detection

**Collision Shapes:**

| Shape | Performance | Use Case |
|-------|-------------|----------|
| Rectangle/Box | Fast | Most common, platforms, walls |
| Circle | Fast | Balls, round objects, projectiles |
| Polygon | Moderate | Complex shapes, precise collision |
| Tilemap | Fast | Level geometry |

**Collision Layers:**
Organize what collides with what:
- Player layer collides with: Enemies, Environment, Collectibles
- Enemy layer collides with: Player, Environment, Player Projectiles
- Player Projectiles layer collides with: Enemies, Environment

**Collision Callbacks:**
```python
# Pseudocode
func on_collision_enter(other):
    if other.is_in_group("enemy"):
        take_damage()
    elif other.is_in_group("collectible"):
        collect_item(other)
        other.queue_free()
```

### Platformer Physics

**Character Controller:**
- Horizontal movement (acceleration, deceleration, max speed)
- Jumping (jump force, variable jump height, coyote time)
- Gravity (fall speed, terminal velocity)
- Ground detection (raycasting or collision)

**Common Techniques:**
- **Coyote Time:** Grace period after leaving platform edge
- **Jump Buffering:** Register jump input slightly before landing
- **Variable Jump Height:** Hold jump for higher jump
- **Wall Sliding:** Slow descent when touching walls
- **Double Jump:** Second jump in mid-air

## 2D Rendering Optimization

### Draw Call Reduction

**Batching:**
Combine multiple sprites into single draw call.

**Requirements:**
- Same texture (sprite sheet)
- Same material/shader
- Same layer/z-order

**Techniques:**
- Use sprite sheets extensively
- Minimize material variations
- Static batching for non-moving objects
- Dynamic batching for moving objects

### Culling

**Frustum Culling:**
Don't render objects outside camera view.

**Implementation:**
- Most engines do this automatically
- Manually disable distant objects if needed

**Object Pooling:**
Reuse objects instead of creating/destroying.

**Use For:**
- Bullets, particles, enemies
- Frequently spawned objects
- Reduces garbage collection

### Layer Management

**Rendering Layers:**
- Background (parallax layers)
- Environment (tiles, props)
- Characters (player, enemies)
- Foreground (particles, effects)
- UI (HUD, menus)

**Z-Ordering:**
Control draw order for overlapping sprites.

## Camera Systems

### Camera Types

**Static Camera:**
Fixed position, no movement.
- Use: Single-screen puzzle games

**Follow Camera:**
Tracks player position.
- Use: Platformers, top-down games

**Smooth Follow:**
Lerp to player position for smooth movement.
```python
camera.position = lerp(camera.position, player.position, smoothing * delta)
```

**Camera Bounds:**
Limit camera to level boundaries.

**Look-Ahead:**
Offset camera in direction player is facing/moving.

### Camera Effects

**Screen Shake:**
Rapid random camera movement for impact.

**Zoom:**
Change camera size for dramatic effect.

**Transitions:**
Smooth camera movement between areas.

## UI and HUD

### UI Elements

**HUD (Heads-Up Display):**
- Health/Energy bars
- Score/Currency display
- Minimap
- Ability cooldowns
- Ammo/Resource counters

**Menus:**
- Main menu
- Pause menu
- Settings
- Inventory

**Design Principles:**
- Clear readability (contrast, font size)
- Consistent style with game art
- Minimal screen clutter
- Responsive feedback (button presses, hover states)

### UI Frameworks

**Godot:**
- Control nodes (Button, Label, TextureRect)
- Anchors and margins for responsive layouts
- Themes for consistent styling

**Unity:**
- UI Toolkit (modern, recommended)
- Legacy UI (Canvas, UI elements)
- Anchors and pivots for responsive design

**Phaser:**
- Game objects for UI
- HTML DOM overlay (alternative)
- Responsive scaling

## Audio Integration

### Audio Types

**Music:**
- Background music (looping)
- Menu music
- Boss battle music
- Ambient soundscapes

**Sound Effects:**
- Player actions (jump, attack, footsteps)
- Enemy sounds
- UI feedback (button clicks, menu navigation)
- Environmental sounds

### Audio Implementation

**Formats:**
- **OGG:** Good compression, widely supported
- **WAV:** Uncompressed, high quality, large files
- **MP3:** Compressed, universal support

**Best Practices:**
- Loop music seamlessly (trim silence, match tempo)
- Normalize volume levels
- Use audio pools for frequently played sounds
- Implement volume controls (master, music, SFX)
- Spatial audio for positional sounds (if applicable)

## Deployment and Distribution

### Platform Targets

**Web (HTML5):**
- Easiest distribution (just a URL)
- Platforms: itch.io, Newgrounds, Kongregate, own website
- Limitations: Performance, file size, browser compatibility

**Desktop:**
- Windows, macOS, Linux
- Distribution: Steam, itch.io, Epic Games Store, GOG
- Larger file sizes acceptable
- Better performance than web

**Mobile:**
- iOS (App Store), Android (Google Play)
- Touch controls required
- Performance optimization critical
- Monetization opportunities (ads, IAP)

### Build Optimization

**Asset Optimization:**
- Compress textures (PNG with tools like TinyPNG)
- Compress audio (OGG at appropriate bitrate)
- Remove unused assets
- Use sprite sheets

**Code Optimization:**
- Minimize garbage collection
- Use object pooling
- Profile and optimize bottlenecks
- Reduce draw calls

## Using the Reference Files

### When to Read Each Reference

**`/references/2d-frameworks-engines.md`** — Read when choosing a 2D engine, comparing framework features, setting up development environments, or learning engine-specific workflows for Godot, Phaser, Unity 2D, LÖVE, or Cocos2d-x.

**`/references/sprite-animation-tilemaps.md`** — Read when implementing sprite animations, creating tilemap levels, designing tilesets, or optimizing sprite rendering and animation systems.

**`/references/2d-physics-collision.md`** — Read when implementing platformer physics, setting up collision detection, creating character controllers, or debugging physics issues in 2D games.

**`/references/2d-optimization-deployment.md`** — Read when optimizing rendering performance, reducing draw calls, preparing builds for specific platforms, or troubleshooting deployment issues for web, mobile, or desktop.
