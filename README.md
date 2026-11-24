# CSC 8470 - Computer Graphics, Final Project - Baseball Minigame

**▶ Play it here: https://robertvakhtangov.github.io/baseball-minigame/**

A Three.js baseball scene: a keyframe-animated pitcher throws, you swing the bat, and a from-scratch physics system decides where the ball goes.

## Controls

| Key | Action |
| --- | --- |
| `Enter` | Pitch |
| `Space` | Swing |
| `C` | Toggle chase view (camera trails the ball) |
| `B` | Toggle ball view (camera tracks the ball) |
| `→` / `←` | Next / previous camera position |

# 1. Date Submitted

12/10/2025

# 2. Time Taken

30 Hours

# 3. URL

https://robertvakhtangov.github.io/baseball-minigame/

# 4. Movie Description

The Pitcher and The Numinous Bat

This is more of a simulation / game than a proper movie, but if I were to work my imagination I would say this is a movie about a miscreant pitcher who has lived an earthly life of pleasure and sin now faced against a bat that has made manifest the will of god to punish his fallen way of life.
The pitcher is stuck in purgatory eternally pitching balls against this disembodied bat with only pleasure known to him now relegated to the few balls the bat manages to miss.

The length of the movie is around 9 seconds long if we go from start to finish of the pitch and the recovery animation, but if we take into consideration both of the recovery animation cumulatively it would be around 12 or so seconds. I hope the extra interactivity makes up for not hitting the exact time mark :)

# 5. Technical Details

## Objects in the scene

There are 5 Objects in total in the scene

The pitcher; The stadium; The textured grass plane; The ball; The bat

The pitcher is a rigged model by Pierrick Picaut - a well known face in the Blender animation community. The model was animated through Blender using keyframe animation, the animation was then broken up into different action sets to make it easier to programmatically use them in Three.js. The model with its animations was then exported as a .glb file and used in Three.js to animate.

The stadium is a .glb model found on SketchFab imported and adjusted for the purposes of this scene

The textured grass plane is a regular Three.js plane geometry with a grass texture painted onto it.

The ball is a simple sphere geometry with white phong material.

The bat is a hierarchical model consisting of cylinders and a half sphere at the end. All use orange phong material

**More on all of these later**

## Camera

The camera uses a variety of different approaches for its movement.
There are several different camera modes that all need their own explanation.

### Default Mode

This is a stationary mode where the camera looks at the scene from a stationary perspective with no special movement.
There are two positions you can cycle through to view at the scene, one from the side and the other from behind the bat.

### Follow Mode

In this mode the camera follows the motion of the ball throughout the scene from its stationary positions.
The two positions remain the same, with the key difference of the camera angle now tracking the ball as it moves.
The way this is achieved is by having a toggle variable in the code which, when active, will have the code continuously execute the camera.lookAt(ball.position) line.
One more thing of note is that this toggle is controlled by the user and is also automatically triggered when the bat successfully hits the ball back.

### Chase Mode

This is a mode where after the ball is pitched, the camera is set to chase the ball around, trailing just behind it while looking at it.
The method used to achieve this is the following: The program calculates the direction vector of the ball, then negates and normalizes it, and attaches the camera to a fixed position along that vector while also having it continuously look at the ball.
A simpler method here would have been to parent the camera to the ball, but the problem with that approach would be that the camera would inevitably start spinning around with the ball if some complex animations were to be made for it. I opted to use the vector approach since it negates the need to correct the camera position if and when any animations are added to the ball itself.

The cameras position / mode is set to default once we prompt the pitcher to pitch.

## Scene Hierarchies

The main form of explicit hierarchy use in this scene is the way the bat functions.

The bat is made up of 4 cylinders of different shapes and sizes, and a hemisphere at the top of it to create its rounded end. The bat is then parented to an empty object slightly further up on the Y angle to create a pivot for a better animation.
While rotating the empty object the bat will seem to rotate along an origin point that is detached from its main body. But this is intentional to mimic the travel path of an actual bat swing closer.
With this I keyframed the rotations in Three.js to create a basic swinging animation programmatically.

This in itself is a form of hierarchy, but it's far from the most important mechanism of behind the bat.

Within this bat object are also placed two empty objects. One at the center of the barrel, and one at the front side of the surface of the barrel. The aim of these two child objects is to calculate the direction vector of the swing, and detect collision with the ball. The implementation details will come later.

## Textures

Admittedly there's very modest amount of texturing going on in the scene as I opted to dedicate more time to working on the simulation parts.
The textured object is the grass field of the stadium. The original .glb model of the stadium had no texturing at all, so in order to break up the solid colors I decided to take advantage of the relief surface of the stadium and position a textured plane object just below the different protrusions, and barely above the original grass field. The texture itself uses wrapping at increments of 20x20 to make sure it doesn't look like a small texture being stretched across a large object.

## Lighting

The lighting is also relatively cut and dry. I used a basic ambient light + directional light setup to light the scene appropriately enough to have everything in view well visible. One of the considerations I had initially was adding a set of spotlights to mimic stadium lights, but in execution it detracted from the experience so I decided against them ultimately. I might revisit this idea later on to fine tune the scene in a way that can accommodate more complex lighting.

## Extra Features

The extra features can be broadly broken up into two categories: The pitcher animation and the physics.

### Pitcher animations

As mentioned, the model used for the pitcher is taken from a free resource created by Pierrick Picaut. The model is very well rigged and allowed for a very smooth animating experience in Blender.
The main points to be made about the Blender animations are the keyframing process and the "conditional" actions.
The keyframing for the throwing animation were done through the use of a set of different reference materials (videos, pose sets). Following proper references always lead to a smoother working experience and a better end result. That being said I also challenged myself to animate the recovery animation by hand.
There are two variations to the recovery animation. One is for when the bat misses its target, and one for when it hits the ball back.
The first variation has a small added gesture where the pitcher swings his left hand upwards as to celebrate his good pitch, the second has this gesture omitted and the pitcher just returns to his original position.

### Physics

This is where most of the hours went.

I wanted to implement a physics system from scratch without using external guidance. The end result is by no means perfect, but for the purposes of this scene they are convincing enough.

The main task was imitating earth's gravity. For this I needed to have a way to imitate velocity and acceleration. After that was done I'd need to implement the hitting mechanic for the bat swing.

### Velocity

Since velocity is displacement over time, what I needed to do is get both of those metrics calculated for the object that I'd apply the physics to. Getting time is simple enough, since the update in the scene is being called per frame, and the Clock object provides multiple ways to get the needed metric/counter.

What proved a bit more of a challenge was getting the displacement.

I had a couple of ideas on how to calculate this properly, but I inevitably settled on doing position calculations each frame for the object that has physics applied to it. The way it works is, each frame we add an `initialPosition` attribute to the object, and in the same function I calculate the difference between the current position of the object and this initialPosition attribute, after which I finally update initialPositions to match the current ones.
What this means in execution is that, on each rendered frame we have access to the previous position, and can thus calculate displacement, which is the second component we need to calculate velocity.
After the calculation the velocity score of each axis (x, y, z) is added as an extra property to the object.
One flaw in this approach is that if you were to manually update the positions of the object at any point throughout the scene, the object would inevitably end up behaving weirdly, for example violently shooting off into the distance.
The way I chose to deal with this problem was by adding metrics for "initialVelocity" as well as "manualVelocity" for when we would want to change the objects position without impacting the velocity calculations, and for when we'd want to programmatically apply a different velocity.
In the end this implementation works to mimic conservation of force/momentum in a convincing enough way.

### Acceleration

Acceleration is defined as the rate of change of velocity over time, so in essence the method for calculating it should be not much different than that for velocity.
In fact, thanks to the update function running frame by frame we can skip any extra calculations altogether and just have a function update the velocity with some scalar each frame. In the case of gravity it would be a downward facing force for example 9.8 for earth's gravity (in execution this value is too large for the scene setup and makes it so the ball falls too fast, so I just have it divided by some value that makes it feel reasonable enough). For when the ball is rolling on the ground there's a friction coefficient to have it come to a stop eventually and not glide around infinitely.

### Hitting With the Bat & Collision Detection

As mentioned previously there are two empty objects at the center and the surface of the barrel of the bat. Their purpose is to calculate the direction vector of the swing of the bat as well as check for collision. Collision in this instance is a pretty simple check of distance from the ball to the empty object, which is calculated by getting the vector between the position of the ball and the position of the empty object in the bat and then getting its length.

As for the trajectory modification after the hit is registered. Since the barrel of a baseball bat is cylindrical there are a lot of variables that go into how the angle of launch of the ball will be determined as a result of a hit, for the sake of making this straight forward I end up treating the collision surface as a "plane" instead of a cylinder. The Y trajectory is set manually and doesn't change between swings, but the angle on the X-Z plane is calculated in the moment of the collision.
The idea is to reflect the direction vector of the ball about the direction vector of the bat, which will result in a pretty realistic representation of how the ball would be deflected in the moment of the collision.

For the sake of making it a bit easier for the user to hit the ball during the pitch the ball is in constant motion when initially thrown, and physics get applied to it only after it gets hit with the bat.

The collision with ground is a simple Y position check for the ball, if we detect that it has passed a certain threshold the balls Y position will continuously be updated to match the ground's Y position. This is to maintain the other velocities while also making sure the ball remains grounded.

One last element for collisions is the boundary checking that goes on to prevent the ball from rolling off into the void. This is done with a similar vector-based approach. From the rough center of the stadium a vector is drawn towards the ball's position but this time we ignore the Y position. What that allows for is to imitate an invisible cylindrical barrier of a set radius, had we included the Y position as well the barrier would end up being shaped like a sphere instead.
After drawing this vector we simply check for the length of this vector and if it exceeds a certain threshold we flip the x and z velocities of the ball.

### Miscellaneous

- For the sake of making the process of hitting the ball a bit more engaging, there are a couple of randomized elements added to both the animation of the pitcher and the throw velocity of the ball. For the pitcher the time he spends in the anticipation pose, and the speed with which he throws the ball are both randomized, thus you as the player need to rely on your reactions to hit the ball back.

- The ball itself is also constantly present in the scene, it's just made visible/invisible as the scene logically demands it.

# 6. References

- Stadium - https://sketchfab.com/3d-models/baseball-field-design-e931638d9c064ec39cb8aff7832bed74
- Pitcher Model - https://www.p2design-academy.com/p/free-rigs
- Grass Texture - Stock image from google search

# 7. Bugs

- There are a bunch of small things I didn't iron out, like transitions between animations for the pitcher being a bit glitchy.
- The collision detection for the stadium is very rudimentary so there is some clipping going on with the back side of the stage.
- Some of the physics calculations get messed up depending on the refresh rate of the monitor on which the animation is being played. The physics still behave as intended but on screens with smaller refresh rate the movement of the ball appears more sluggish.
