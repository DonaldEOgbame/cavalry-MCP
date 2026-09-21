# Cavalry 2.7.2 Official Node Schema Reference

Generated from the installed official `nodeDefinitions.json`. Attribute names and types are runtime schema evidence.

## 3dMatrix

Node identifier: 3dMatrix.
Supertype: behaviour.
Concrete attributes (10):
- `out`
- `position` — type=double2
- `positionZ` — type=double
- `rotation` — type=double2
- `rotationZ` — type=double
- `alignX` — type=double, default=0
- `alignY` — type=double, default=0
- `levelMode` — type=enum
- `level` — type=int, default=1
- `useLevels` — type=bool, default=false

## accumulator

Node identifier: accumulator.
Supertype: atomic.
Concrete attributes (4):
- `out` — type=double
- `value` — type=double
- `offset` — type=double
- `padding` — type=double

## addDivisions

Node identifier: addDivisions.
Supertype: behaviourBase.
Concrete attributes (7):
- `out`
- `strength` — type=double, default=100
- `maxLength` — type=double, default=1
- `divisions` — type=int, default=20
- `mode` — type=enum, default=0
- `edgeLength` — type=int, default=20
- `keepOriginalPoints` — type=bool, default=true

## align

Node identifier: align.
Supertype: behaviour.
Concrete attributes (3):
- `out`
- `x` — type=double, default=0
- `y` — type=double, default=0

## animationControl

Node identifier: animationControl.
Supertype: atomic.
Concrete attributes (4):
- `controlHelp` — type=bool, default=true
- `amount` — type=double
- `active` — type=bool, default=true
- `out` — type=double, default=0

## animationCurve

Node identifier: animationCurve.
Supertype: animationCurveBase.
Concrete attributes (3):
- `out` — type=double, default=0
- `offset` — type=double, default=0
- `dataType` — type=enum, default=1

## animationCurveBase

Node identifier: animationCurveBase.
Supertype: none.
Concrete attributes (14):
- `time` — type=double, default=0
- `legacyConstrain` — type=bool, default=false
- `postInfinity` — type=enum, default=0
- `preInfinity` — type=enum, default=0
- `controlType` — type=enum, default=0
- `rigControlValues` — type=double2
- `percent` — type=double, default=0
- `usePercent` — type=bool, default=false
- `colorMode` — type=enum, default=0
- `activeAnimationLayer` — type=nodeId
- `disableAnimationLayers` — type=bool, default=false
- `animationLayers` — type=list
- `keyframes` — type=list
- `keyframesOrderCache` — type=intVector

## animationPath

Node identifier: animationPath.
Supertype: animationCurveBase.
Concrete attributes (2):
- `out` — type=editablePath2
- `celAnimation` — type=bool, default=false

## applyCharacterSpacing

Node identifier: applyCharacterSpacing.
Supertype: textStyleBehaviour.
Concrete attributes (1):
- `pairs` — type=list

## applyDistribution

Node identifier: applyDistribution.
Supertype: behaviourBase.
Tags: beta.
Concrete attributes (5):
- `distribution` — type=nodeId
- `levelMode` — type=enum
- `level` — type=int, default=1
- `hcenter` — type=bool, default=true
- `vcenter` — type=bool, default=true

## applyFontSize

Node identifier: applyFontSize.
Supertype: textStyleBehaviour.
Concrete attributes (8):
- `fontSize` — type=double, default=100
- `mode` — type=enum, default=1
- `range` — type=int2
- `regex` — type=string, default="[0-9]+"
- `captureGroupIndices` — type=string, default=""
- `indexMode` — type=enum, default=2
- `indices` — type=string, default="first,last"
- `falloffs` — type=list

## applyFontStyle

Node identifier: applyFontStyle.
Supertype: textStyleBehaviour.
Concrete attributes (10):
- `underline` — type=bool, default=true
- `strikethrough` — type=bool
- `supersInferiorsMode` — type=enum
- `mode` — type=enum, default=1
- `range` — type=int2
- `regex` — type=string, default="[0-9]+"
- `captureGroupIndices` — type=string, default=""
- `indexMode` — type=enum, default=1
- `indices` — type=string, default="first,last"
- `falloffs` — type=list

## applyLayout

Node identifier: applyLayout.
Supertype: behaviourBase.
Tags: beta.
Concrete attributes (7):
- `layout` — type=layoutFunctor
- `resolution` — type=int2
- `level` — type=int, default=1
- `verticalAlignment` — type=double, default=0.5
- `horizontalAlignment` — type=double, default=0.5
- `columnSpan` — type=int, default=1
- `rowSpan` — type=int, default=1

## applyOpenType

Node identifier: applyOpenType.
Supertype: textStyleBehaviour.
Concrete attributes (8):
- `features` — type=list
- `mode` — type=enum, default=1
- `range` — type=int2
- `regex` — type=string, default="[0-9]+"
- `captureGroupIndices` — type=string, default=""
- `indexMode` — type=enum, default=2
- `indices` — type=string, default="first,last"
- `falloffs` — type=list

## applyTextFill

Node identifier: applyTextFill.
Supertype: textMaterialBehaviour.
Concrete attributes (9):
- `mode` — type=enum
- `range` — type=int2
- `regex` — type=string, default="[0-9]+"
- `captureGroupIndices` — type=string, default=""
- `indexMode` — type=enum, default=2
- `indices` — type=string, default="first, last"
- `fillColor` — type=color, default={"r":100,"g":55,"b":255,"a":255}
- `shaders` — type=list
- `alpha` — type=double, default=100

## applyTextMaterial

Node identifier: applyTextMaterial.
Supertype: textMaterialBehaviour.
Concrete attributes (14):
- `mode` — type=enum, default=1
- `range` — type=int2
- `regex` — type=string, default="[0-9]+"
- `captureGroupIndices` — type=string, default=""
- `indexMode` — type=enum, default=2
- `indices` — type=string, default="first, last"
- `material` — type=nodeId
- `stroke` — type=nodeId
- `filtersHelp` — type=bool, default=true
- `filters` — type=list
- `deformers` — type=list
- `overwriteBlendMode` — type=bool, default=false
- `blendMode` — type=enum, default=3
- `falloffs` — type=list

## applyTypeface

Node identifier: applyTypeface.
Supertype: textStyleBehaviour.
Concrete attributes (9):
- `font` — type=font, default={"font":"Lato","style":"Bold"}
- `fontAxes` — type=list
- `out` — type=typeface
- `mode` — type=enum, default=1
- `range` — type=int2
- `regex` — type=string, default="[0-9]+"
- `captureGroupIndices` — type=string, default=""
- `indexMode` — type=enum, default=2
- `indices` — type=string, default="first, last"

## arcShape

Node identifier: arcShape.
Supertype: primitive.
Concrete attributes (6):
- `divisions` — type=int, default=0
- `radius` — type=double, default=100
- `width` — type=double, default=40
- `endAngle` — type=double, default=270
- `startAngle` — type=double, default=90
- `bezier` — type=bool, default=true

## areaRange

Node identifier: areaRange.
Supertype: behaviourBase.
Concrete attributes (5):
- `out` — type=double, default=0
- `area` — type=double, default=0
- `maxArea` — type=double, default=1000
- `dimensions` — type=double2, default={"x":200,"y":200}
- `constrainOutput` — type=bool, default=false

## areaRangeBase

Node identifier: areaRangeBase.
Supertype: remapper.
Tags: Remap.
Concrete attributes (4):
- `out` — type=double, default=0
- `maxArea` — type=double, default=1000
- `dimensions` — type=double2, default={"x":200,"y":200}
- `constrainOutput` — type=bool, default=false

## arrayDistribution

Node identifier: arrayDistribution.
Supertype: distribution.
Concrete attributes (1):
- `array` — type=list, default={"list":[{}]}

## arrayManipulator

Node identifier: arrayManipulator.
Supertype: atomic.
Tags: beta.
Concrete attributes (2):
- `out` — type=anyVector, read-only
- `generator` — type=nodeId

## arrowShape

Node identifier: arrowShape.
Supertype: primitive.
Concrete attributes (4):
- `bodyLength` — type=double, default=200
- `bodyWidth` — type=double, default=75
- `generateFirstHead` — type=arrowHeadGenerator
- `generateSecondHead` — type=arrowHeadGenerator

## asset

Node identifier: asset.
Supertype: element.
Concrete attributes (1):
- `out` — type=assetId

## assetArray

Node identifier: assetArray.
Supertype: indexableArray.
Concrete attributes (2):
- `array` — type=list, default={"list":[{}]}
- `out` — type=assetId

## assetFromSmartFolder

Node identifier: assetFromSmartFolder.
Supertype: atomic.
Concrete attributes (7):
- `file` — type=assetId
- `mode` — type=enum
- `index` — type=int
- `out` — type=assetId
- `count` — type=int, read-only
- `path` — type=string
- `outPath` — type=string, read-only

## attractorField

Node identifier: attractorField.
Supertype: dynamicField.
Concrete attributes (0):

## audioTrack

Node identifier: audioTrack.
Supertype: atomic.
Concrete attributes (3):
- `file` — type=nodeId
- `beatCounter` — type=int
- `value` — type=double

## autoAnimate

Node identifier: autoAnimate.
Supertype: behaviourBase.
Concrete attributes (43):
- `out`
- `progressMode` — type=enum, default=0
- `animationModeHelp` — type=bool, default=true
- `progress` — type=double, default=0
- `positionProgress` — type=double, default=100
- `positionMode` — type=enum, default=2
- `directionMode` — type=enum, default=2
- `distance` — type=double, default=1000
- `angleDistance` — type=double2, default={"x":0,"y":100}
- `alternateDirection` — type=bool, default=false
- `rotationProgress` — type=double, default=100
- `rotationMode` — type=enum, default=0
- `reverseRotationAngle` — type=bool, default=false
- `scaleProgress` — type=double, default=100
- `scaleMode` — type=enum, default=0
- `scaleFromMode` — type=enum, default=0
- `opacityProgress` — type=double, default=100
- `opacityMode` — type=enum, default=1
- `visibilityProgress` — type=double, default=100
- `visibilityMode` — type=enum, default=0
- `zoom` — type=double, default=1500
- `automaticTimeOffset` — type=bool, default=true
- `timeOffset` — type=double, default=-20
- `reverseTimeOffset` — type=bool, default=false
- `timingMode` — type=enum, default=1
- `randomSeed` — type=int
- `resolution` — type=int2
- `levelMode` — type=enum, default=3
- `level` — type=int, default=1
- `useLevels` — type=bool, default=false
- `groupByParent` — type=bool, default=false
- `parentTimingMode` — type=enum, default=1
- `parentRandomSeed` — type=int
- `reverseParentOrder` — type=bool, default=false
- `useLevelsHelp` — type=bool, default=true
- `timingHelp` — type=bool, default=true
- `offsetAnimationMode` — type=enum, default=0
- `offsetAnimationModeHelp` — type=bool, default=true
- `bendAngle` — type=double, default=0
- `bendVerticalPin` — type=enum, default=0
- `bendHorizontalPin` — type=enum, default=0
- `bendDirection` — type=enum, default=0
- `bendProgress` — type=double, default=100

## autoCrop

Node identifier: autoCrop.
Supertype: behaviour.
Concrete attributes (7):
- `out`
- `alignX` — type=double, default=0
- `alignY` — type=double, default=0
- `progressMode` — type=enum, default=0
- `cropAmount` — type=double2
- `cropSize` — type=double2
- `maskShapeMode` — type=enum

## backgroundBlurFilter

Node identifier: backgroundBlurFilter.
Supertype: filter.
Concrete attributes (6):
- `filterInputCompositing` — default=1
- `amount` — type=double2, default={"x":10,"y":10}
- `tileMode` — type=enum, default=2
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=3
- `inputShape` — type=nodeId

## backgroundShape

Node identifier: backgroundShape.
Supertype: shape.
Concrete attributes (3):
- `material`
- `shrink` — type=int2
- `resolution` — type=int2

## barbedHead

Node identifier: barbedHead.
Supertype: arrowHead.
Concrete attributes (3):
- `headLength` — type=double, default=100
- `barbWidth` — type=double, default=125
- `barbPosition` — type=double, default=60

## barChart

Node identifier: barChart.
Supertype: chartEngine.
Concrete attributes (9):
- `file` — type=assetId
- `xAxisColumn` — type=double
- `seriesMode` — type=enum
- `series` — type=list
- `maximumHeight` — type=double, default=500
- `cornerRadius` — type=double, default=0
- `barWidth` — type=double, default=100
- `gapBetweenBars` — type=double, default=30
- `gapBetweenStacks` — type=double, default=0

## basicArrowHead

Node identifier: basicArrowHead.
Supertype: arrowHead.
Concrete attributes (3):
- `headLength` — type=double, default=100
- `headWidth` — type=double, default=75
- `barbLength` — type=double, default=0

## basicLine

Node identifier: basicLine.
Supertype: shape.
Tags: Spiral, Bezier.
Concrete attributes (2):
- `stroke`
- `generator` — type=nodeId

## basicShape

Node identifier: basicShape.
Supertype: shape.
Concrete attributes (2):
- `generator` — type=nodeId
- `material`

## behaviourMixer

Node identifier: behaviourMixer.
Supertype: behaviourBase.
Concrete attributes (2):
- `behaviour` — type=list, default={"list":[{}]}
- `out`

## bend

Node identifier: bend.
Supertype: behaviourBase.
Concrete attributes (11):
- `bendAngle` — type=double, default=40
- `verticalPin` — type=enum, default=0
- `horizontalPin` — type=enum, default=0
- `direction` — type=enum, default=0
- `out`
- `strength` — type=double, default=100
- `automaticResampling` — type=bool, default=true
- `levelMode` — type=enum
- `level` — type=int, default=1
- `useLevels` — type=bool, default=false
- `highQuality` — type=bool, default=false

## bentoShape

Node identifier: bentoShape.
Supertype: shape.
Concrete attributes (12):
- `material`
- `size` — type=double2, default={"x":1000,"y":800}
- `gridColumns` — type=double, default=6
- `gridRows` — type=double, default=4
- `gap` — type=double, default=10
- `cornerRadius` — type=double, default=8
- `heroMode` — type=enum, default=0
- `heroCount` — type=int, default=1
- `heroSize` — type=double2, default={"x":2,"y":2}
- `heroPositionX` — type=double, default=0.5
- `heroPositionY` — type=double, default=0.5
- `randomSeed` — type=int, default=0

## bevel

Node identifier: bevel.
Supertype: behaviour.
Concrete attributes (7):
- `radius` — type=double, default=20
- `mode` — type=enum
- `radiusMode` — type=enum, default=0
- `curveToEndPoints` — type=bool, default=false
- `minAngle` — type=double, default=0
- `maxAngle` — type=double, default=180
- `out`

## bezierLine

Node identifier: bezierLine.
Supertype: lineGenerator.
Concrete attributes (4):
- `startPosition` — type=double2, default={"x":-200,"y":200}
- `endPosition` — type=double2, default={"x":200,"y":-200}
- `startOffset` — type=double2, default={"x":100,"y":0}
- `endOffset` — type=double2, default={"x":-100,"y":0}

## blackAndWhite

Node identifier: blackAndWhite.
Supertype: filter.
Concrete attributes (7):
- `matteApplyMode` — default=1
- `red` — type=double, default=100
- `yellow` — type=double, default=0
- `green` — type=double, default=100
- `cyan` — type=double, default=0
- `blue` — type=double, default=100
- `magenta` — type=double, default=0

## blendShader

Node identifier: blendShader.
Supertype: shader.
Concrete attributes (3):
- `shaders` — type=list
- `blendMode` — type=enum, default=3
- `alpha` — type=double, default=100

## blendShape

Node identifier: blendShape.
Supertype: behaviourBase.
Concrete attributes (3):
- `blendShapes` — type=list, default={"list":[{}]}
- `out`
- `mode` — type=enum, default=0

## blendSubMeshPositions

Node identifier: blendSubMeshPositions.
Supertype: behaviourBase.
Concrete attributes (8):
- `out`
- `blend` — type=double
- `inputShape` — type=nodeId
- `timeOffset` — type=double
- `useGlobalTransforms` — type=bool, default=false
- `strength` — type=double, default=100
- `levelMode` — type=enum, default=1
- `level` — type=int, default=1

## blendSubMeshPositionsLegacy

Node identifier: blendSubMeshPositionsLegacy.
Supertype: behaviourBase.
Concrete attributes (6):
- `out`
- `blend` — type=double
- `inputShape` — type=nodeId
- `timeOffset` — type=double
- `useGlobalTransforms` — type=bool, default=false
- `strength` — type=double, default=100

## blurFilter

Node identifier: blurFilter.
Supertype: filter.
Concrete attributes (4):
- `filterInputCompositing` — default=1
- `matteApplyMode` — default=1
- `amount` — type=double2, default={"x":10,"y":10}
- `tileMode` — type=enum, default=2

## bodySettingCollisionEvent

Node identifier: bodySettingCollisionEvent.
Supertype: collisionEvent.
Concrete attributes (20):
- `killOnCollision` — type=bool, default=false
- `useCollisionCount` — type=bool, default=false
- `collisionCount` — type=int, default=1
- `setSensor` — type=bool, default=false
- `sensor` — type=bool, default=false
- `setFriction` — type=bool, default=false
- `friction` — type=double, default=0.5
- `setBounce` — type=bool, default=false
- `bounce` — type=double, default=0.3
- `setDensity` — type=bool, default=false
- `density` — type=double, default=10
- `setGravityScale` — type=bool, default=false
- `gravityScale` — type=double, default=1
- `useCollisionIndex` — type=bool, default=false
- `time` — type=int
- `specificCollisions` — type=bool, default=false
- `specificIndices` — type=string, default="0"
- `fps` — type=int
- `fadeChanges` — type=bool, default=false
- `fadeTime` — type=double, default=1

## bone

Node identifier: bone.
Supertype: drawable.
Concrete attributes (9):
- `showInProjectWindow` — type=bool, default=true
- `rotationRestPose` — type=double, default=0
- `globalRestPose` — type=transform
- `rotationFK` — type=double, default=0
- `chain` — type=string, default=""
- `rotationIK` — type=double, default=0
- `lengthRestPose` — type=double, default=200
- `stretchFactor` — type=double, default=1
- `length` — type=double

## boolean

Node identifier: boolean.
Supertype: behaviourBase.
Concrete attributes (3):
- `out`
- `connectionData` — type=string, default="{\"connTypes\":[]}"
- `clippingShapes` — type=list

## boundingBox

Node identifier: boundingBox.
Supertype: atomic.
Concrete attributes (7):
- `rect` — type=rect, read-only
- `position` — type=double2, read-only
- `expand` — type=double2
- `size` — type=double2
- `inputShapes` — type=list
- `sampleAtFrame` — type=bool, default=false
- `sampleFrame` — type=int, default=0

## boundingBoxConstraint

Node identifier: boundingBoxConstraint.
Supertype: atomic.
Concrete attributes (5):
- `width` — type=double, default=50
- `height` — type=double, default=50
- `offset` — type=double2
- `out` — type=double2
- `inputShape` — type=nodeId

## boundingBoxShape

Node identifier: boundingBoxShape.
Supertype: shape.
Concrete attributes (5):
- `inputShape` — type=nodeId
- `shapeDepth` — type=int, default=0
- `expand` — type=double2
- `offset` — type=double2
- `cornerRounding` — type=double

## boxHead

Node identifier: boxHead.
Supertype: arrowHead.
Concrete attributes (3):
- `boxSize` — type=double2, default={"x":120,"y":120}
- `boxHole` — type=bool, default=0
- `boxHoleSize` — type=double2, default={"x":50,"y":50}

## bridgeConstraint

Node identifier: bridgeConstraint.
Supertype: forgeConstraint.
Concrete attributes (11):
- `breakable` — type=bool, default=false
- `breakingForce` — type=double, default=2
- `breakingMode` — type=enum, default=0
- `stretchLimit` — type=double, default=5
- `breakingDuration` — type=int, default=20
- `stressThreshold` — type=double, default=10
- `reportStress` — type=bool, default=false
- `stretch` — type=double, default=0.1
- `frequencyHz` — type=double, default=4
- `dampingRatio` — type=double, default=0.3
- `pins` — type=list

## brightnessAndContrast

Node identifier: brightnessAndContrast.
Supertype: filter.
Concrete attributes (3):
- `brightness` — type=double, default=0
- `contrast` — type=double, default=0
- `matteApplyMode` — default=1

## buoyancyField

Node identifier: buoyancyField.
Supertype: dynamicField.
Concrete attributes (12):
- `size` — type=double2, default=[600,200]
- `fluidDensity` — type=double, default=20
- `buoyancyStrength` — type=double, default=1
- `dragCoefficient` — type=double, default=2
- `liftCoefficient` — type=double, default=0
- `angularDrag` — type=double, default=0.2
- `enableUprighting` — type=bool, default=true
- `uprightingStrength` — type=double, default=5
- `uprightAngle` — type=double, default=0
- `surfaceTension` — type=bool, default=false
- `surfaceTensionForce` — type=double, default=5
- `surfaceThickness` — type=double, default=10

## cameraGuide

Node identifier: cameraGuide.
Supertype: drawable.
Concrete attributes (3):
- `customColor` — type=bool
- `nullColor` — type=color, default={"r":58,"g":174,"b":240,"a":255}
- `resolution` — type=int2

## capsuleShape

Node identifier: capsuleShape.
Supertype: primitive.
Concrete attributes (8):
- `divisions` — type=int2, default={"x":0,"y":0}
- `drawMode` — type=enum, default=0
- `length` — type=double, default=200
- `start` — type=double2, default={"x":0,"y":0}
- `end` — type=double2, default={"x":200,"y":0}
- `radius` — type=double2, default={"x":50,"y":50}
- `trimEnds` — type=double2, default={"x":0,"y":100}
- `bezier` — type=bool, default=true

## celAnimationShape

Node identifier: celAnimationShape.
Supertype: editableShape.
Concrete attributes (3):
- `timeScale` — type=double, default=1
- `time` — type=double, default=0
- `stroke`

## cellularNoise

Node identifier: cellularNoise.
Supertype: noiseEngine.
Concrete attributes (3):
- `jitter` — type=double, default=0.5
- `distanceFunction` — type=enum, default=0
- `cellularType` — type=enum, default=0

## changeStringCase

Node identifier: changeStringCase.
Supertype: stringOperator.
Concrete attributes (3):
- `mode` — type=enum, default=1
- `exclusionList` — type=string, default=""
- `newLineDelimeter` — type=bool, default=false

## chartShape

Node identifier: chartShape.
Supertype: shape.
Concrete attributes (2):
- `generator` — type=nodeId
- `material`

## checkerboardShader

Node identifier: checkerboardShader.
Supertype: shader.
Concrete attributes (6):
- `size` — type=int2, default={"x":20,"y":20}
- `offset` — type=double2, default={"x":0,"y":0}
- `rotation` — type=double, default=0
- `alpha` — type=double, default=100
- `filterQuality` — type=enum, default=1
- `blendMode` — type=enum, default=3

## chevronHead

Node identifier: chevronHead.
Supertype: arrowHead.
Concrete attributes (4):
- `headLength` — type=double, default=100
- `headWidth` — type=double, default=75
- `chevronLength` — type=double, default=0
- `chevronPosition` — type=double, default=60

## chopPath

Node identifier: chopPath.
Supertype: behaviourBase.
Concrete attributes (8):
- `count` — type=int, default=10
- `flattenShape` — type=bool, default=false
- `flattenShapeHelp` — type=bool, default=true
- `angle` — type=double, default=30
- `offset` — type=double, default=0
- `spread` — type=double, default=100
- `spreadHelp` — type=bool, default=true
- `deformers` — type=list

## chromaticAberrationFilter

Node identifier: chromaticAberrationFilter.
Supertype: filter.
Concrete attributes (22):
- `red` — type=color, default={"r":255,"g":0,"b":0,"a":255}
- `green` — type=color, default={"r":0,"g":255,"b":0,"a":255}
- `blue` — type=color, default={"r":0,"g":0,"b":255,"a":255}
- `lensType` — type=enum, default=1
- `scale` — type=double2, default={"x":100,"y":100}
- `passes` — type=int, default=1
- `passDist` — type=int, default=10
- `rotation` — type=double, default=0
- `strength` — type=double, default=100
- `radius` — type=int, default=600
- `redOffset` — type=double, default=100
- `greenOffset` — type=double, default=130
- `blueOffset` — type=double, default=70
- `angle` — type=int, default=0
- `alignmentX` — type=double, default=0
- `alignmentY` — type=double, default=0
- `baseLayer` — type=bool, default=true
- `rAngle` — type=double, default=1
- `gAngle` — type=double, default=1
- `bAngle` — type=double, default=1
- `viewPort` — type=double, default=0
- `matteApplyMode` — default=1

## chromaticDisplacement

Node identifier: chromaticDisplacement.
Supertype: filter.
Concrete attributes (14):
- `amplitude` — type=double, default=10
- `redAngle` — type=double, default=0
- `redDistance` — type=double, default=1
- `greenAngle` — type=double, default=120
- `greenDistance` — type=double, default=1
- `blueAngle` — type=double, default=240
- `blueDistance` — type=double, default=1
- `displacementMode` — type=enum, default=0
- `blur` — type=double, default=0
- `shader` — type=shaderData
- `shaderOpacity` — type=double, default=100
- `showPreview` — type=bool, default=false
- `blendMode` — type=enum, default=1
- `opacity` — type=double, default=100

## circleDistribution

Node identifier: circleDistribution.
Supertype: distribution.
Concrete attributes (9):
- `count` — type=int, default=3
- `radius` — type=double, default=200
- `startAngle` — type=double, default=0
- `angle` — type=double, default=360
- `includeEnd` — type=bool
- `flip` — type=bool
- `calculateRotations` — type=bool, default=true
- `useIndex` — type=bool, default=true
- `travel` — type=double, default=0

## circleHead

Node identifier: circleHead.
Supertype: arrowHead.
Concrete attributes (3):
- `circleRadius` — type=double2, default={"x":60,"y":60}
- `circleHole` — type=bool, default=0
- `circleHoleRadius` — type=double2, default={"x":25,"y":25}

## circleShape

Node identifier: circleShape.
Supertype: primitive.
Concrete attributes (2):
- `divisions` — type=int, default=0
- `radius` — type=double, default=100

## cleanUp

Node identifier: cleanUp.
Supertype: behaviourBase.
Concrete attributes (5):
- `out`
- `useDistance` — type=bool, default=false
- `distance` — type=double, default=10
- `useAngle` — type=bool, default=false
- `angle` — type=double, default=5

## cogwheelGearShape

Node identifier: cogwheelGearShape.
Supertype: primitive.
Concrete attributes (5):
- `teeth` — type=int, default=8
- `pitchRadius` — type=double, default=200
- `radiusHole` — type=double, default=100
- `toothDepth` — type=double2, default={"x":50,"y":20}
- `toothTaper` — type=double2, default={"x":20,"y":15}

## cogwheelShape

Node identifier: cogwheelShape.
Supertype: primitive.
Concrete attributes (7):
- `teeth` — type=int, default=12
- `radius` — type=double, default=90
- `thickness` — type=double, default=20
- `toothThickness` — type=double, default=0
- `taper` — type=double2, default={"x":15,"y":25}
- `radiusHole` — type=double, default=45
- `midpointPosition` — type=double, default=0.5

## collisionModifier

Node identifier: collisionModifier.
Supertype: particleModifier.
Concrete attributes (3):
- `logic` — type=bool, default=false
- `margin` — type=double, default=10
- `out` — type=particlePoolData

## colorArray

Node identifier: colorArray.
Supertype: indexableArray.
Concrete attributes (2):
- `array` — type=list
- `out`

## colorBlend

Node identifier: colorBlend.
Supertype: behaviour.
Concrete attributes (5):
- `out`
- `gradient` — type=list
- `strength` — type=double, default=100
- `useAlpha` — type=bool, default=true
- `gradientMode` — type=enum

## colorCollisionEvent

Node identifier: colorCollisionEvent.
Supertype: collisionEvent.
Concrete attributes (13):
- `fillColor` — type=color, default={"r":255,"g":100,"b":100,"a":255}
- `mode` — type=enum, default=0
- `fadeChanges` — type=bool, default=false
- `fadeTime` — type=double, default=1
- `useCollisionIndex` — type=bool, default=false
- `time` — type=int
- `fps` — type=int
- `shaders` — type=list
- `specificCollisions` — type=bool, default=false
- `specificIndices` — type=string, default="0"
- `fadeToThirdColor` — type=bool, default=false
- `thirdFillColor` — type=color, default={"r":100,"g":100,"b":200,"a":255}
- `thirdShaders` — type=list

## colorInfo

Node identifier: colorInfo.
Supertype: atomic.
Concrete attributes (3):
- `out` — type=double
- `inColor` — type=color, default={"r":58,"g":174,"b":240,"a":255}
- `mode` — type=enum, default=2

## colorMaterial

Node identifier: colorMaterial.
Supertype: material.
Tags: material.
Concrete attributes (4):
- `materialColor` — type=color, default={"r":100,"g":100,"b":100}
- `alpha` — type=double, default=100
- `colorShaders` — type=list
- `out` — type=fill

## colorShader

Node identifier: colorShader.
Supertype: shader.
Concrete attributes (3):
- `shaderColor` — type=color, default={"r":100,"g":100,"b":255,"a":255}
- `alpha` — type=double, default=100
- `blendMode` — type=enum, default=3

## colorSwatch

Node identifier: colorSwatch.
Supertype: none.
Concrete attributes (1):
- `color` — type=color, default={"r":100,"g":100,"b":100}

## comparison

Node identifier: comparison.
Supertype: mathBase.
Concrete attributes (4):
- `first` — type=double, default=0
- `second` — type=double, default=1
- `operation` — type=enum, default=0
- `out` — type=bool, read-only

## compConstraint

Node identifier: compConstraint.
Supertype: atomic.
Concrete attributes (5):
- `resolution` — type=int2
- `width` — type=double, default=50
- `height` — type=double, default=50
- `offset` — type=double2
- `out` — type=double2

## compNode

Node identifier: compNode.
Supertype: drawable.
Concrete attributes (32):
- `resolution` — type=int2, default={"x":1920,"y":1080}
- `startFrame` — type=int, default=0
- `endFrame` — type=int, default=249
- `playbackStart` — type=int, default=0
- `playbackEnd` — type=int, default=249
- `inTime` — type=double
- `time` — type=double
- `uiTime` — type=double
- `playbackStep` — type=int, default=1
- `grid` — type=gridData
- `showGrid` — type=bool, default=false
- `availableAsReference` — type=bool, default=true
- `backgroundColor` — type=color, default={"r":255,"g":255,"b":255,"a":255}
- `fps` — type=double, default=25
- `activeAnimationLayer` — type=nodeId
- `outActiveAnimationLayer` — type=nodeId, read-only
- `motionBlur` — type=bool
- `shutterAngle` — type=double, default=180
- `motionBlurSamples` — type=int, default=16
- `blurCentre` — type=double, default=0
- `blurAlign` — type=double, default=0
- `linearGamma` — type=bool, default=false
- `activeAudioLayer` — type=nodeId
- `timeMarkers` — type=nodeId
- `endpointMarkers` — type=nodeId
- `frameRange` — type=int2
- `rangeConstraints` — type=list
- `fitRange` — type=bool, default=false
- `beatMarkers` — type=compound
- `cameraTransform` — type=list
- `cameraMatrix` — type=transform44
- `overrides` — type=list

## component

Node identifier: component.
Supertype: group.
Concrete attributes (3):
- `promotedAttributes` — type=list
- `editing` — type=bool, default=true
- `compactLayout` — type=bool, default=false

## componentConstraint

Node identifier: componentConstraint.
Supertype: atomic.
Concrete attributes (2):
- `out` — type=double2, read-only
- `generator` — type=nodeId

## compositionReference

Node identifier: compositionReference.
Supertype: shape.
Concrete attributes (13):
- `colorId` — default=4
- `composition` — type=nodeId
- `timeOffset` — type=double
- `time` — type=double
- `timeRemapping` — type=double
- `length` — type=int, read-only
- `selection` — type=int2
- `playAudio` — type=bool, default=true
- `preserveFPS` — type=bool, default=false
- `viewportZoomAware` — type=bool, default=true
- `overrideHelp` — type=bool, default=true
- `overrides` — type=list
- `artboard` — type=bool, default=false

## concatenateStringArray

Node identifier: concatenateStringArray.
Supertype: stringOperator.
Concrete attributes (4):
- `array` — type=list, default={"list":[{}]}
- `delimiter` — type=string, default=""
- `delimiterAtStart` — type=bool
- `delimiterAtEnd` — type=bool

## conicalGradientShader

Node identifier: conicalGradientShader.
Supertype: gradientOperator.
Concrete attributes (9):
- `gradient` — type=list
- `endEdgeRotation` — type=double, default=-45
- `startEdgeRotation` — type=double, default=45
- `startCenter` — type=double2
- `startRadius` — type=double, default=0
- `endRadius` — type=double, default=1
- `wrapUVs` — type=bool, default=false
- `endCenter` — type=double2
- `offset` — type=double2

## conicalGradientShaderLegacy

Node identifier: conicalGradientShaderLegacy.
Supertype: gradientOperator.
Concrete attributes (11):
- `gradient` — type=list
- `reverseGrad` — type=bool, default=false
- `firstRadius` — type=double, default=100
- `firstCenter` — type=double2
- `secondRadius` — type=double, default=10
- `secondCenter` — type=double2
- `radiusMode` — type=enum, default=1
- `firstRadiusRatio` — type=double, default=0.8
- `secondRadiusRatio` — type=double, default=0.1
- `firstRatioCenter` — type=double2
- `secondRatioCenter` — type=double2

## connectShape

Node identifier: connectShape.
Supertype: shape.
Concrete attributes (18):
- `sourceGenerator` — type=nodeId
- `targetGenerator` — type=nodeId
- `targetMode` — type=enum, default=1
- `autoBezierMode` — type=enum, default=1
- `distance` — type=double, default=400
- `lineType` — type=enum, default=0
- `controlPointLengthBias` — type=double2, default={"x":0.5,"y":0.5}
- `ignoreTarget` — type=bool, default=false
- `sortByDistance` — type=bool, default=true
- `maxPerPointConnections` — type=int, default=5
- `maxConnections` — type=int, default=1000
- `subjectBezierBias` — type=double, default=100
- `targetBezierBias` — type=double, default=100
- `skip` — type=int, default=1
- `skipOffset` — type=int
- `timeOffset` — type=double, default=0
- `projectionTarget` — type=nodeId
- `stroke`

## contextIndex

Node identifier: contextIndex.
Supertype: atomic.
Concrete attributes (3):
- `depth` — type=int, default=1
- `offset` — type=int
- `out` — type=int

## contoursToSubMeshes

Node identifier: contoursToSubMeshes.
Supertype: behaviourBase.
Concrete attributes (2):
- `out`
- `keepHoles` — type=bool, default=true

## contrastingColor

Node identifier: contrastingColor.
Supertype: atomic.
Concrete attributes (6):
- `out` — type=color
- `inputColor` — type=color, default={"r":58,"g":174,"b":240,"a":255}
- `primaryColor` — type=color, default={"r":0,"g":0,"b":0,"a":255}
- `secondaryColor` — type=color, default={"r":200,"g":200,"b":200,"a":255}
- `mode` — type=enum, default=2
- `customRatio` — type=double, default=2

## convexHull

Node identifier: convexHull.
Supertype: shape.
Concrete attributes (3):
- `material`
- `shapes` — type=list
- `highQuality` — type=bool, default=true

## cornerPinShape

Node identifier: cornerPinShape.
Supertype: shape.
Concrete attributes (11):
- `material`
- `topLeft` — type=nodeId
- `topRight` — type=nodeId
- `bottomLeft` — type=nodeId
- `bottomRight` — type=nodeId
- `topLeftOffset` — type=double2
- `topRightOffset` — type=double2
- `bottomLeftOffset` — type=double2
- `bottomRightOffset` — type=double2
- `bind` — type=bool, default=true
- `size` — type=double2, default={"x":200,"y":200}

## countSubMeshes

Node identifier: countSubMeshes.
Supertype: atomic.
Concrete attributes (4):
- `inputShape` — type=nodeId
- `levelMode` — type=enum, default=1
- `level` — type=int, default=1
- `count` — type=int, read-only

## crtScanLines

Node identifier: crtScanLines.
Supertype: filter.
Concrete attributes (20):
- `linesCount` — type=double, default=128
- `lineMode` — type=enum, default=0
- `lineSize` — type=double, default=10
- `lineWidth` — type=double, default=50
- `lineFeather` — type=double, default=50
- `lineOpacity` — type=double, default=100
- `offset` — type=double, default=0
- `realRes` — type=bool, default=true
- `lineColor` — type=color, default={"r":0,"g":0,"b":0,"a":255}
- `angle` — type=double, default=0
- `shadowMaskMode` — type=bool, default=false
- `shadowMaskOpacity` — type=double, default=100
- `shadowMaskScale` — type=int, default=1
- `brightnessBoost` — type=double, default=50
- `interlaceFrameInterval` — type=int, default=0
- `frame` — type=double
- `redPixel` — type=color, default={"r":255,"g":0,"b":0,"a":255}
- `greenPixel` — type=color, default={"r":0,"g":255,"b":0,"a":255}
- `bluePixel` — type=color, default={"r":0,"g":0,"b":255,"a":255}
- `matteApplyMode` — default=1

## cubicNoise

Node identifier: cubicNoise.
Supertype: noiseEngine.
Concrete attributes (5):
- `octaves` — type=int, default=1
- `lacunarity` — type=double, default=2
- `gain` — type=double, default=0.5
- `curl` — type=bool, default=false
- `curlAmplitude` — type=double, default=50

## curvesToLines

Node identifier: curvesToLines.
Supertype: behaviourBase.
Concrete attributes (2):
- `linesPerCurve` — type=int, default=4
- `out`

## customDistribution

Node identifier: customDistribution.
Supertype: distribution.
Concrete attributes (1):
- `input` — type=nodeId

## customShape

Node identifier: customShape.
Supertype: shape.
Concrete attributes (2):
- `bakeTransform` — type=bool, default=false
- `inputShape` — type=polyMesh

## dataModifier

Node identifier: dataModifier.
Supertype: particleModifier.
Concrete attributes (14):
- `kill` — type=bool, default=false
- `changeEmitterId` — type=bool, default=false
- `emitterId` — type=int, default=1
- `lifespanMode` — type=enum, default=0
- `lifespan` — type=double, default=5
- `age` — type=double, default=5
- `ageOnArrival` — type=bool, default=false
- `resetVelocity` — type=bool, default=false
- `clampVelocity` — type=bool, default=false
- `velocityLimit` — type=double2, default={"x":30,"y":30}
- `compFps` — type=double
- `customColor` — type=bool
- `drawColor` — type=color, default={"r":58,"g":174,"b":240,"a":255}
- `out` — type=particlePoolData

## directionField

Node identifier: directionField.
Supertype: dynamicField.
Concrete attributes (2):
- `directionalForce` — type=double2, default={"x":1,"y":0}
- `angularForce` — type=double

## displacementUtility

Node identifier: displacementUtility.
Supertype: drawable.
Concrete attributes (4):
- `shapeType` — type=enum, default=0
- `customColor` — type=bool
- `drawColor` — type=color, default={"r":58,"g":174,"b":240,"a":255}
- `size` — type=double2, default={"x":200,"y":200}

## distance

Node identifier: distance.
Supertype: behaviour.
Concrete attributes (3):
- `out`
- `target` — type=nodeId
- `offset` — type=double, default=0

## distanceConstraint

Node identifier: distanceConstraint.
Supertype: forgeConstraint.
Concrete attributes (15):
- `restLength` — type=double, default=100
- `minLength` — type=double, default=0
- `maxLength` — type=double, default=500
- `frequencyHz` — type=double, default=4
- `dampingRatio` — type=double, default=0.3
- `inputShape` — type=nodeId
- `breakable` — type=bool, default=false
- `breakingForce` — type=double, default=0.25
- `breakingMode` — type=enum, default=0
- `stretchLimit` — type=double, default=5
- `breakingDuration` — type=int, default=20
- `stressThreshold` — type=double, default=10
- `reportStress` — type=bool, default=false
- `verticalAlignment` — type=double, default=0
- `horizontalAlignment` — type=double, default=0

## distortEdges

Node identifier: distortEdges.
Supertype: filter.
Concrete attributes (10):
- `border` — type=double, default=20
- `amplitude` — type=double, default=20
- `sharpness` — type=double, default=0
- `direction` — type=enum, default=0
- `sampleMode` — type=enum, default=0
- `shader` — type=shaderData
- `shaderOpacity` — type=double, default=100
- `showPreview` — type=bool, default=false
- `blendMode` — type=enum, default=1
- `opacity` — type=double, default=100

## distortionFilter

Node identifier: distortionFilter.
Supertype: filter.
Concrete attributes (17):
- `offset` — type=double, default=0
- `autoPad` — type=bool, default=false
- `padding` — type=double, default=0
- `compSize` — type=int2
- `amplitude` — type=double, default=50
- `directionMode` — type=enum, default=0
- `sampleMode` — type=enum, default=0
- `singleDirection` — type=bool, default=false
- `direction` — type=double, default=0
- `invert` — type=bool, default=false
- `curveInterpolation` — type=enum, default=1
- `legacy` — type=bool, default=false
- `shader` — type=shaderData
- `shaderOpacity` — type=double, default=100
- `showPreview` — type=bool, default=false
- `blendMode` — type=enum, default=1
- `opacity` — type=double, default=100

## distributionEmitter

Node identifier: distributionEmitter.
Supertype: particleEmitterBase.
Concrete attributes (8):
- `initialSpeed` — type=double, default=10
- `initialDirection` — type=double, default=0
- `emissionMode` — type=enum, default=1
- `rateMode` — type=enum, default=1
- `rate` — type=double, default=100
- `fps` — type=double
- `generator` — type=nodeId
- `seed` — type=int

## ditheringFilter

Node identifier: ditheringFilter.
Supertype: filter.
Concrete attributes (22):
- `matteApplyMode` — default=1
- `filterInputCompositing` — default=1
- `size` — type=int, default=4
- `strength` — type=double, default=1
- `contrast` — type=double, default=0.5
- `greyscaleMode` — type=enum, default=0
- `shader` — type=shaderData
- `usePalette` — type=bool, default=false
- `legacy` — type=bool, default=false
- `colorBit` — type=int, default=4
- `mode` — type=enum, default=0
- `pattern` — type=enum, default=2
- `white` — type=color, default={"r":255,"g":255,"b":255,"a":255}
- `black` — type=color, default={"r":0,"g":0,"b":0,"a":255}
- `red` — type=color, default={"r":255,"g":0,"b":0,"a":255}
- `green` — type=color, default={"r":0,"g":255,"b":0,"a":255}
- `blue` — type=color, default={"r":0,"g":0,"b":255,"a":255}
- `yellow` — type=color, default={"r":255,"g":255,"b":0,"a":255}
- `magenta` — type=color, default={"r":255,"g":0,"b":255,"a":255}
- `cyan` — type=color, default={"r":0,"g":255,"b":255,"a":255}
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=1

## dragField

Node identifier: dragField.
Supertype: dynamicField.
Concrete attributes (1):
- `force` — type=double, default=0.05

## dropShadowFilter

Node identifier: dropShadowFilter.
Supertype: filter.
Concrete attributes (5):
- `offset` — type=double2, default={"x":5,"y":-5}
- `rotation` — type=double
- `amount` — type=double2, default={"x":5,"y":5}
- `shadowColor` — type=color, default={"r":0,"g":0,"b":0,"a":100}
- `matteApplyMode` — default=1

## duplicator

Node identifier: duplicator.
Supertype: shape.
Tags: Distribution.
Concrete attributes (14):
- `shapes` — type=list
- `shapePosition` — type=double2
- `shapeRotation` — type=double
- `shapeScale` — type=double2, default={"x":1,"y":1}
- `shapeSkew` — type=double2
- `shapeVisibility` — type=bool, default=true
- `shapeOpacity` — type=double, default=100
- `autoId` — type=bool, default=true
- `shapeId` — type=int
- `shapeTimeOffset` — type=double
- `generator` — type=nodeId
- `useIndex` — type=bool, default=true
- `indexContext` — type=int, read-only
- `skipInvisibleDuplicates` — type=bool, default=false

## dynamicIndexManager

Node identifier: dynamicIndexManager.
Supertype: element.
Concrete attributes (3):
- `backgroundRendering` — type=bool, default=false
- `dynamicIndex` — type=int, default=0, read-only
- `dynamicIndexOffset` — type=int, default=0

## edgeConstraint

Node identifier: edgeConstraint.
Supertype: constraintOperator.
Concrete attributes (8):
- `target` — type=nodeId
- `offset` — type=double2
- `index` — type=int
- `bias` — type=double, default=0.5
- `strength` — type=double, default=100
- `rotationStrength` — type=double, default=100
- `normalBias` — type=double
- `outRotation` — type=double, read-only

## edgeDetection

Node identifier: edgeDetection.
Supertype: filter.
Concrete attributes (10):
- `threshold` — type=double, default=20
- `sampleSpacing` — type=double, default=100
- `algorithm` — type=enum, default=0
- `greyScaleMode` — type=enum, default=0
- `deNoise` — type=double, default=100
- `stepLines` — type=bool, default=false
- `opacity` — type=double, default=100
- `lineColor` — type=color, default={"r":0,"g":0,"b":0,"a":255}
- `bgColor` — type=color, default={"r":255,"g":255,"b":255,"a":255}
- `blendMode` — type=enum, default=1

## editablePathArray

Node identifier: editablePathArray.
Supertype: indexableArray.
Concrete attributes (2):
- `array` — type=list, default={"list":[{}]}
- `out`

## editableShape

Node identifier: editableShape.
Supertype: shape.
Concrete attributes (6):
- `material`
- `inputPath` — type=editablePath2
- `animation` — type=compound
- `rigControlValues` — type=double2
- `fillRule` — type=enum, default=0
- `onionSkinning` — type=bool, default=true

## ellipseShape

Node identifier: ellipseShape.
Supertype: primitive.
Concrete attributes (4):
- `divisions` — type=int, default=0
- `bezier` — type=bool, default=true
- `radius` — type=double2, default={"x":100,"y":100}
- `semicircle` — type=bool, default=false

## envilopeDistort

Node identifier: envilopeDistort.
Supertype: behaviourBase.
Concrete attributes (3):
- `targetShape` — type=nodeId
- `strength` — type=double, default=100
- `out` — read-only

## epicycloid

Node identifier: epicycloid.
Supertype: distribution.
Concrete attributes (5):
- `count` — type=int, default=500
- `radius` — type=double, default=30
- `seed` — type=double, default=3.6
- `length` — type=double, default=5
- `hypo` — type=bool, default=false

## epitrochoid

Node identifier: epitrochoid.
Supertype: distribution.
Concrete attributes (5):
- `count` — type=int, default=500
- `radius` — type=double, default=30
- `seed` — type=double2, default={"x":1.6,"y":5}
- `length` — type=double, default=5
- `hypo` — type=bool, default=false

## extendOpenPaths

Node identifier: extendOpenPaths.
Supertype: behaviourBase.
Concrete attributes (12):
- `extendStart` — type=double, default=30
- `extendEnd` — type=double, default=30
- `lengthMode` — type=enum, default=0
- `angleMode` — type=enum, default=0
- `startAngle` — type=double, default=0
- `endAngle` — type=double, default=0
- `arcExtendStart` — type=bool, default=true
- `arcExtendEnd` — type=bool, default=true
- `arcRadius` — type=double, default=50
- `arcSweepAngle` — type=double, default=45
- `arcDirection` — type=enum, default=0
- `oppositeDirectionForEnd` — type=bool, default=false

## extractSubMeshes

Node identifier: extractSubMeshes.
Supertype: shape.
Concrete attributes (6):
- `inputShape` — type=nodeId
- `range` — type=int2, default={"x":0,"y":1}
- `ignoreEmptySubMeshes` — type=bool, default=true
- `indices` — type=string, default="first, last"
- `levelMode` — type=enum, default=1
- `level` — type=int, default=1

## extrude

Node identifier: extrude.
Supertype: shape.
Concrete attributes (9):
- `material`
- `inputShapes` — type=list
- `extrudeDistance` — type=double, default=100
- `extrudeAngle` — type=double, default=30
- `levelMode` — type=enum, default=4
- `level` — type=int, default=1
- `combineMeshes` — type=bool, default=true
- `capEnd` — type=bool, default=true
- `backFaceCulling` — type=bool, default=false

## falloff

Node identifier: falloff.
Supertype: drawable.
Concrete attributes (18):
- `shapeType` — type=enum, default=0
- `graph` — type=list
- `useProbability` — type=bool, default=0
- `seed` — type=int
- `repetitions` — type=int
- `angles` — type=double2, default={"x":0,"y":360}
- `out` — type=doubleVector
- `strength` — type=double, default=100
- `customColor` — type=bool
- `drawColor` — type=color, default={"r":58,"g":174,"b":240,"a":255}
- `size` — type=double2, default={"x":200,"y":200}
- `enabled` — type=bool, default=true
- `is3d` — type=bool, default=false
- `hidden` — type=bool, default=false
- `inputShapes` — type=list
- `pathDistance` — type=double, default=100
- `pathMode` — type=enum, default=0
- `globalRestPose` — type=transform

## fibonacciDistribution

Node identifier: fibonacciDistribution.
Supertype: distribution.
Concrete attributes (3):
- `count` — type=int, default=50
- `radius` — type=double, default=250
- `angle` — type=double, default=360

## fill

Node identifier: fill.
Supertype: filter.
Concrete attributes (4):
- `fillColor` — type=color, default={"r":100,"g":125,"b":155,"a":255}
- `blendMode` — type=enum, default=3
- `premultiply` — type=bool, default=true
- `matteApplyMode` — default=1

## fillRule

Node identifier: fillRule.
Supertype: behaviourBase.
Concrete attributes (1):
- `mode` — type=enum, default=0

## flare

Node identifier: flare.
Supertype: behaviour.
Concrete attributes (6):
- `amount` — type=double, default=1
- `startFlare` — type=double, default=0.5
- `endFlare` — type=double, default=1
- `graph` — type=list
- `direction` — type=enum, default=0
- `out`

## flattenShapeLayers

Node identifier: flattenShapeLayers.
Supertype: behaviourBase.
Concrete attributes (3):
- `mode` — type=enum, default=0
- `maintainTransforms` — type=bool, default=false
- `removeEmptySubMeshes` — type=bool, default=true

## flowFieldModifier

Node identifier: flowFieldModifier.
Supertype: particlePhysicsModifier.
Concrete attributes (8):
- `forceMagnitude` — type=double, default=10
- `physicsMode` — type=enum, default=0
- `showPreview` — type=bool, default=false
- `size` — type=double, default=10
- `customColor` — type=bool
- `generator` — type=nodeId
- `drawColor` — type=color, default={"r":251,"g":218,"b":20,"a":255}
- `out` — type=particlePoolData

## flowFieldNoise

Node identifier: flowFieldNoise.
Supertype: noiseEngine.
Concrete attributes (5):
- `octaves` — type=int, default=1
- `lacunarity` — type=double, default=2
- `gain` — type=double, default=0.5
- `curl` — type=bool, default=false
- `curlAmplitude` — type=double, default=50

## footageShape

Node identifier: footageShape.
Supertype: shape.
Concrete attributes (5):
- `material`
- `shrink` — type=int2
- `resolution` — type=int2, read-only
- `footageShader` — type=shaderData
- `timeOffset` — type=double, default=0

## forceModifier

Node identifier: forceModifier.
Supertype: particlePhysicsModifier.
Concrete attributes (7):
- `forceVelocity` — type=double2, default={"x":0,"y":100}
- `physicsMode` — type=enum, default=0
- `customColor` — type=bool
- `drawColor` — type=color, default={"r":58,"g":174,"b":240,"a":255}
- `overrideMass` — type=bool, default=false
- `mass` — type=double, default=5
- `massOverLifespan` — type=list

## forgeBodyAuxiliary

Node identifier: forgeBodyAuxiliary.
Supertype: atomic.
Concrete attributes (2):
- `constraints` — type=list
- `collisionEvents` — type=list

## forgeDynamicsShape

Node identifier: forgeDynamicsShape.
Supertype: shape.
Concrete attributes (28):
- `shapes` — type=list
- `time` — type=int
- `fps` — type=double, default=25
- `startFrame` — type=int
- `resolution` — type=int2
- `gravity` — type=double2, default={"x":0,"y":-10}
- `groundMode` — type=enum, default=2
- `groundFriction` — type=double, default=1
- `groundBounce` — type=double, default=0.1
- `velocityIterations` — type=int, default=30
- `positionIterations` — type=int, default=10
- `fields` — type=list
- `collisionEvents` — type=list
- `initialPosVelocity` — type=double2
- `initialRotVelocity` — type=double
- `useMaxPosVelocity` — type=bool
- `useMaxRotVelocity` — type=bool
- `maxPosVelocity` — type=double, default=50
- `maxRotVelocity` — type=double
- `initialStatePositionStrength` — type=double
- `initialStateRotationStrength` — type=double
- `worldScale` — type=double, default=1
- `data` — type=forgeSolverData
- `useCache` — type=bool, default=false
- `cacheFilePath` — type=string
- `cache` — type=solverCacheRead, read-only
- `cacheOffset` — type=int
- `timeStep` — type=enum, default=0

## formattedDateAndTime

Node identifier: formattedDateAndTime.
Supertype: textEngine.
Concrete attributes (2):
- `inputString` — type=string, default="<d>-<DD>-<m>"
- `time` — type=double, default=0

## fourPointWarp

Node identifier: fourPointWarp.
Supertype: behaviour.
Concrete attributes (9):
- `centre` — type=double2
- `size` — type=double2
- `corner0` — type=compound
- `corner1` — type=compound
- `corner2` — type=compound
- `corner3` — type=compound
- `strength` — type=double, default=100
- `triangulate` — type=bool, default=false
- `quality` — type=enum, default=1

## frame

Node identifier: frame.
Supertype: behaviour.
Concrete attributes (9):
- `value` — type=double, default=1
- `offset` — type=double, default=0
- `startFrame` — type=int, default=0
- `cycleLength` — type=double, default=1
- `fps` — type=double
- `graph` — type=list
- `mode` — type=enum
- `time` — type=double, default=0
- `out`

## frostedGlassFilter

Node identifier: frostedGlassFilter.
Supertype: filter.
Concrete attributes (6):
- `tint` — type=color, default={"r":145,"g":220,"b":255,"a":128}
- `strength` — type=double, default=50
- `scale` — type=double, default=100
- `radius` — type=double, default=1
- `detail` — type=int, default=4
- `center` — type=double2, default={"x":0,"y":0}

## gammaCorrectionFilter

Node identifier: gammaCorrectionFilter.
Supertype: filter.
Concrete attributes (5):
- `gamma` — type=double, default=2.2
- `premultiply` — type=bool, default=true
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=1
- `matteApplyMode` — default=1

## gaussianBlurFilter

Node identifier: gaussianBlurFilter.
Supertype: filter.
Concrete attributes (3):
- `filterInputCompositing` — default=1
- `amount` — type=double2, default={"x":10,"y":10}
- `tileMode` — type=enum, default=2

## gaussianDropShadowFilter

Node identifier: gaussianDropShadowFilter.
Supertype: filter.
Concrete attributes (4):
- `offset` — type=double2, default={"x":5,"y":-5}
- `rotation` — type=double
- `amount` — type=double2, default={"x":5,"y":5}
- `shadowColor` — type=color, default={"r":0,"g":0,"b":0,"a":100}

## getLayerName

Node identifier: getLayerName.
Supertype: atomic.
Concrete attributes (2):
- `inputShape` — type=nodeId
- `out` — type=string, read-only

## getSubMeshTransform

Node identifier: getSubMeshTransform.
Supertype: atomic.
Concrete attributes (9):
- `inputShape` — type=nodeId
- `levelMode` — type=enum, default=1
- `level` — type=int, default=1
- `index` — type=int, default=0
- `useBoundingBox` — type=bool
- `position` — type=double2
- `rotation` — type=double
- `scale` — type=double2, default={"x":1,"y":1}
- `transform` — type=transform

## getVector

Node identifier: getVector.
Supertype: behaviourBase.
Concrete attributes (4):
- `out`
- `target` — type=nodeId
- `normalize` — type=bool, default=true
- `strength` — type=double, default=100

## glowFilter

Node identifier: glowFilter.
Supertype: filter.
Concrete attributes (15):
- `filterInputCompositing` — default=1
- `blur` — type=int2, default={"x":20,"y":20}
- `complex` — type=bool, default=false
- `blurR` — type=int2, default={"x":20,"y":20}
- `blurG` — type=int2, default={"x":30,"y":30}
- `blurB` — type=int2, default={"x":10,"y":10}
- `gamma` — type=double, default=1
- `whitePoint` — type=double, default=1
- `opacity` — type=double, default=100
- `intensity` — type=double, default=1
- `drawMode` — type=enum
- `mode` — type=enum
- `intensityRGB` — type=double3, default={"x":1,"y":1,"z":1}
- `glowColor` — type=color, default={"r":255,"g":255,"b":255}
- `blendMode` — type=enum, default=12

## goalModifier

Node identifier: goalModifier.
Supertype: particlePhysicsModifier.
Concrete attributes (10):
- `inputPoints` — type=nodeId
- `forceScale` — type=double, default=1
- `maxDistance` — type=double, default=500
- `arrival` — type=bool
- `brakingScale` — type=double, default=0.5
- `brakingDistance` — type=double, default=200
- `customColor` — type=bool
- `physicsMode` — type=enum, default=0
- `drawColor` — type=color, default={"r":58,"g":174,"b":240,"a":255}
- `out` — type=particlePoolData

## gradientBuilder

Node identifier: gradientBuilder.
Supertype: atomic.
Concrete attributes (6):
- `out` — type=gradient, default={"points":[{"interpolation":"linear","position":0,"value":{"a":255,"b":0,"g":0,"r":0}},{"interpolation":"linear","position":1,"value":{"a":255,"b":255,"g":255,"r":255}}]}, read-only
- `stopCount` — type=int, default=2
- `positions` — type=double
- `colours` — type=color
- `positionModifier` — type=double
- `useIndex` — type=bool, default=false

## gradientFilter

Node identifier: gradientFilter.
Supertype: filter.
Concrete attributes (9):
- `tiling` — type=enum, default=0
- `gradientMode` — type=enum, default=0
- `generator` — type=nodeId
- `alpha` — type=double, default=100
- `reverse` — type=bool, default=false
- `premultiply` — type=bool, default=true
- `blendMode` — type=enum, default=3
- `screenSpace` — type=bool, default=false
- `resolution` — type=int2

## gradientMapFilter

Node identifier: gradientMapFilter.
Supertype: filter.
Concrete attributes (9):
- `matteApplyMode` — default=1
- `alpha` — type=double, default=100
- `gradientMode` — type=enum, default=0
- `reverse` — type=bool, default=false
- `premultiply` — type=bool, default=true
- `colorFilter` — type=enum, default=0
- `greyscaleMode` — type=enum, default=0
- `blendMode` — type=enum, default=1
- `gradient` — type=list

## gradientShader

Node identifier: gradientShader.
Supertype: shader.
Concrete attributes (9):
- `tiling` — type=enum, default=0
- `gradientMode` — type=enum, default=0
- `generator` — type=nodeId
- `alpha` — type=double, default=100
- `reverse` — type=bool, default=false
- `premultiply` — type=bool, default=true
- `blendMode` — type=enum, default=3
- `screenSpace` — type=bool, default=false
- `resolution` — type=int2

## gradientStopArray

Node identifier: gradientStopArray.
Supertype: indexableArray.
Concrete attributes (5):
- `positionArray` — type=list, default={"list":[{"value":1,"varType":"double"},{}]}
- `valueArray` — type=list, default={"list":[{"value":"#FFAD3771","varType":"color"},{}]}
- `typeArray` — type=list, default={"list":[{},{}]}
- `out`
- `preview` — type=gradient, read-only

## grainFilter

Node identifier: grainFilter.
Supertype: filter.
Concrete attributes (9):
- `amount` — type=double, default=50
- `highlightMultiplier` — type=double, default=50
- `midtoneMultiplier` — type=double, default=25
- `shadowMultiplier` — type=double, default=12.5
- `grainSize` — type=double, default=0.5
- `monochromatic` — type=bool
- `logColorSpace` — type=bool
- `time` — type=int
- `blendMode` — type=enum, default=1

## gridDistribution

Node identifier: gridDistribution.
Supertype: distribution.
Concrete attributes (5):
- `count` — type=int2, default={"x":3,"y":3}
- `size` — type=double2, default={"x":200,"y":200}
- `direction` — type=enum
- `offset` — type=double2, default={"x":0,"y":0}
- `distributionMode` — type=enum, default=0

## gridLayout

Node identifier: gridLayout.
Supertype: layoutItem.
Tags: beta.
Concrete attributes (12):
- `rows` — type=int, default=3
- `columns` — type=int, default=3
- `direction` — type=enum
- `paddingLR` — type=double2, default={"x":25,"y":25}
- `paddingTB` — type=double2, default={"x":25,"y":25}
- `cellMargins` — type=double, default=10
- `reverseLayout` — type=bool, default=false
- `shuffle` — type=bool, default=false
- `seed` — type=int, default=false
- `scaleToFit` — type=bool, default=true
- `scaleMultiplier` — type=double, default=1
- `keepAspectRatio` — type=bool, default=true

## gridLayoutGroup

Node identifier: gridLayoutGroup.
Supertype: layoutGroupBase.
Concrete attributes (5):
- `locked` — default=true
- `spacing` — type=int2
- `orderingPolicy` — type=enum, default=0
- `flipOrder` — type=bool, default=false
- `shuffleSeed` — type=int, default=false

## gridLayoutRow

Node identifier: gridLayoutRow.
Supertype: layoutGroupBase.
Concrete attributes (5):
- `outColumnWidths` — type=int2Vector
- `minimumColumnWidth` — type=int, default=0
- `orderingPolicy` — type=enum, default=0
- `flipOrder` — type=bool, default=false
- `shuffleSeed` — type=int, default=false

## group

Node identifier: group.
Supertype: shape.
Concrete attributes (2):
- `colorId` — default=1
- `groupMode` — type=enum, default=1

## growthSolver

Node identifier: growthSolver.
Supertype: atomic.
Concrete attributes (6):
- `out` — type=pointData
- `inputPoints` — type=any
- `radius` — type=double, default=50
- `time` — type=int
- `startFrame` — type=int
- `endFrame` — type=int

## halftoneFilter

Node identifier: halftoneFilter.
Supertype: filter.
Concrete attributes (25):
- `size` — type=double, default=20
- `sampleMode` — type=enum, default=0
- `rotation` — type=double, default=0
- `contrast` — type=double, default=1
- `blackGamma` — type=double, default=2.2
- `offset` — type=double2, default={"x":0,"y":0}
- `threshold` — type=double, default=1
- `pattern` — type=enum, default=0
- `customRed` — type=double, default=1
- `customGreen` — type=double, default=1
- `customBlue` — type=double, default=1
- `softness` — type=double, default=0
- `backColor` — type=color, default={"r":255,"g":255,"b":255,"a":255}
- `foreColor` — type=color, default={"r":0,"g":0,"b":0,"a":255}
- `useCMYK` — type=bool, default=true
- `yellow` — type=color, default={"r":255,"g":255,"b":0,"a":255}
- `yellowTransform` — type=double3, default={"x":0,"y":0,"z":15}
- `magenta` — type=color, default={"r":255,"g":0,"b":255,"a":255}
- `magentaTransform` — type=double3, default={"x":0,"y":0,"z":25}
- `cyan` — type=color, default={"r":0,"g":255,"b":255,"a":255}
- `cyanTransform` — type=double3, default={"x":0,"y":0,"z":35}
- `black` — type=color, default={"r":0,"g":0,"b":0,"a":255}
- `blackTransform` — type=double3, default={"x":0,"y":0,"z":45}
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=1

## halftoneLegacyFilter

Node identifier: halftoneLegacyFilter.
Supertype: filter.
Concrete attributes (12):
- `count` — type=int, default=20
- `greyMode` — type=enum, default=0
- `rotation` — type=double, default=0
- `center` — type=double2, default={"x":0,"y":0}
- `size` — type=double, default=1
- `r` — type=double, default=1
- `g` — type=double, default=1
- `b` — type=double, default=1
- `antialiasing` — type=double, default=0
- `invert` — type=bool, default=false
- `backColor` — type=color, default={"r":255,"g":255,"b":255,"a":255}
- `circleColor` — type=color, default={"r":0,"g":0,"b":0,"a":255}

## hiddenFolder

Node identifier: hiddenFolder.
Supertype: element.
Concrete attributes (1):
- `showInProjectWindow` — default=true

## horizontalLayout

Node identifier: horizontalLayout.
Supertype: layoutItem.
Tags: beta.
Concrete attributes (8):
- `autoSpacing` — type=bool, default=false
- `paddingLR` — type=double2, default={"x":25,"y":25}
- `paddingTB` — type=double2, default={"x":25,"y":25}
- `spacing` — type=double, default=3
- `reverseLayout` — type=bool, default=false
- `invertLayout` — type=bool, default=false
- `shuffle` — type=bool, default=false
- `seed` — type=int, default=false

## hsvAdjustmentFilter

Node identifier: hsvAdjustmentFilter.
Supertype: filter.
Concrete attributes (8):
- `filterInputCompositing` — default=1
- `useHsl` — type=bool, default=false
- `hue` — type=double
- `saturation` — type=double
- `legacySaturation` — type=bool, default=true
- `value` — type=double
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=1

## hsvColor

Node identifier: hsvColor.
Supertype: atomic.
Concrete attributes (5):
- `out` — type=color
- `in` — type=color
- `hue` — type=double, default=125
- `saturation` — type=double, default=0.4
- `value` — type=double, default=0.7

## hueSaturationLightness

Node identifier: hueSaturationLightness.
Supertype: filter.
Concrete attributes (5):
- `channel` — type=enum, default=0
- `hue` — type=double, default=0
- `saturation` — type=double, default=0
- `lightness` — type=double, default=0
- `matteApplyMode` — default=1

## ifElse

Node identifier: ifElse.
Supertype: atomic.
Concrete attributes (4):
- `condition` — type=bool
- `first` — type=any
- `second` — type=any
- `out` — type=any

## imageModifier

Node identifier: imageModifier.
Supertype: particleModifier.
Concrete attributes (8):
- `inputImage` — type=assetId, default=""
- `loopSequence` — type=bool, default=false
- `scaleMode` — type=enum, default=0
- `sequenceMode` — type=enum, default=0
- `imageIndexOffset` — type=int, default=0
- `fitToLifespan` — type=bool, default=true
- `fps` — type=double
- `out` — type=ParticleShapeData

## imageSampler

Node identifier: imageSampler.
Supertype: drawable.
Concrete attributes (12):
- `strength` — type=double, default=100
- `invert` — type=bool, default=false
- `opacity` — default=50
- `image` — type=assetId, default=""
- `out` — type=color
- `time` — type=double, default=0
- `looping` — type=bool, default=true
- `tilingX` — type=enum, default=0
- `tilingY` — type=enum, default=0
- `enabled` — type=bool, default=true
- `offset` — type=double, default=0
- `channel` — type=enum, default=0

## imageShader

Node identifier: imageShader.
Supertype: shader.
Concrete attributes (24):
- `image` — type=assetId, default=""
- `alpha` — type=double, default=100
- `blendMode` — type=enum, default=3
- `autoSize` — type=bool, default=true
- `screenSpace` — type=bool, default=false
- `legacyScaleModes` — type=bool, default=false
- `resolution` — type=int2
- `inFps` — type=double
- `fps` — type=double
- `scaleMode` — type=enum, default=1
- `missingImageMode` — type=enum, default=0
- `tilingX` — type=enum, default=0
- `tilingY` — type=enum, default=0
- `scale` — type=double2, default={"x":1,"y":1}
- `offset` — type=double2
- `rotation` — type=double, default=0
- `time` — type=double, default=0
- `timeOffset` — type=double, default=0
- `on` — type=bool, default=1
- `looping` — type=bool, default=false
- `sequenceLength` — type=int, read-only
- `outResolution` — type=int2, read-only
- `filterQuality` — type=enum, default=2
- `overrideQuality` — type=bool, default=false

## imageToShapes

Node identifier: imageToShapes.
Supertype: shape.
Concrete attributes (6):
- `image` — type=assetId, default=""
- `iterations` — type=int, default=10
- `mode` — type=enum, default=0
- `filterQuality` — type=enum, default=0
- `time` — type=double, default=0
- `looping` — type=bool, default=true

## impulseCollisionEvent

Node identifier: impulseCollisionEvent.
Supertype: collisionEvent.
Concrete attributes (5):
- `useBounceDirection` — type=bool, default=true
- `directionalPower` — type=double, default=50
- `angularPower` — type=double, default=0
- `direction` — type=double2, default={"x":50,"y":0}
- `time` — type=int

## indexToColor

Node identifier: indexToColor.
Supertype: atomic.
Concrete attributes (6):
- `value` — type=double, default=0
- `gradient` — type=list
- `reverse` — type=bool, default=false
- `useIndex` — type=bool, default=true
- `out` — type=any
- `gradientMode` — type=enum

## innerShadowFilter

Node identifier: innerShadowFilter.
Supertype: filter.
Concrete attributes (6):
- `offset` — type=double2
- `amount` — type=double2, default={"x":10,"y":10}
- `shadowColor` — type=color, default={"r":0,"g":0,"b":0}
- `opacity` — type=double, default=100
- `spread` — type=double, default=0
- `blendMode` — type=enum, default=3

## intersectionDistribution

Node identifier: intersectionDistribution.
Supertype: connectDistribution.
Concrete attributes (1):
- `inputShapes` — type=list

## inverseKinematicsControl

Node identifier: inverseKinematicsControl.
Supertype: null.
Concrete attributes (8):
- `showInProjectWindow` — type=bool, default=false
- `endEffector` — type=nodeId
- `chainLength` — type=int, default=3
- `stretch` — type=bool, default=false
- `tolerance` — type=double, default=0.01
- `maxIterations` — type=int, default=10
- `preRotate` — type=bool, default=false
- `preRotateOffset` — type=double, default=-90

## invert

Node identifier: invert.
Supertype: filter.
Concrete attributes (6):
- `channel` — type=enum, default=0
- `skipTransparent` — type=bool, default=true
- `preserveEdges` — type=bool, default=false
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=1
- `matteApplyMode` — default=1

## isolinesShape

Node identifier: isolinesShape.
Supertype: shape.
Concrete attributes (12):
- `inputShape` — type=nodeId
- `levels` — type=int, default=5
- `gridSize` — type=int, default=10
- `outputBeziers` — type=bool, default=true
- `cleanupPath` — type=bool, default=true
- `filterPathSize` — type=bool, default=false
- `pathSize` — type=double, default=2
- `stroke`
- `image` — type=assetId, default=""
- `mode` — type=enum, default=1
- `looping` — type=bool, default=true
- `time` — type=double, default=0

## isWithin

Node identifier: isWithin.
Supertype: behaviourBase.
Concrete attributes (3):
- `inputShape` — type=nodeId
- `invert` — type=bool
- `out` — type=bool, read-only

## javaScript

Node identifier: javaScript.
Supertype: mathBase.
Concrete attributes (4):
- `expression` — type=string, default="function isPrime(n) {\n    for (let i = 2; i * i <= n; i++) {\n        if ( n % i == 0) return false;\n    }\n    return true;\n}\n\nisPrime(n0);"
- `array` — type=dynamic, default={"list":[{"value":0,"varType":"double"}]}
- `legacyPerformance` — type=bool, default=false
- `out` — type=double

## javaScriptDeformer

Node identifier: javaScriptDeformer.
Supertype: behaviourBase.
Concrete attributes (5):
- `generator` — type=polyMesh
- `array` — type=dynamic, default={"list":[{"value":0,"varType":"double"}]}
- `expression` — type=string, default="// Use a sine wave to displace every point vertically by +/- `amplitude`\nvar depth = def.highestDepthWithPath(); // This matches the first meshes with geometry.\nvar pi = 3.14159;\nvar frequency = 4;\nvar amplitude = 30;\n \nvar meshes = def.getMeshesAtDepth(depth); // Get the meshes at the given depth\nvar bbox = def.getBoundingBox();\nvar [minX, maxX] = [bbox.x, bbox.x+bbox.width];\n\nfor (var mesh of meshes) {\n    var path = mesh.getPathAtIndex(0); // Get the first path in the mesh\n    path.resample(5); // Add some extra points so we get a smoother deformation\n    var pd = path.pathData(); // get the point data for the path\n\n    for (var idx = 0; idx < pd.length; idx++) {\n        if (pd[idx].type == \"close\") { // skip close verbs, they have no point to move\n            continue;\n        }\n         // we want 'xpos' in the range 0 to 1\n        let xpos = cavalry.norm(pd[idx].point.x, minX, maxX);\n        // 'displacement' ranges from 'amplitude' to 0\n        let displacement = amplitude * (1 - xpos);\n        // control start of the sine wave with 'n0' - the attribute below.\n        let t = (n0 * 0.1 + xpos * 2 * pi);\n        pd[idx].point.y += Math.sin(t * frequency) * displacement;\n    }\n    // Set the point data\n    path.setPathData(pd);\n    // Set the path\n    mesh.setPathAtIndex(0, path);\n}\n// Set the mesh\ndef.setMeshesAtDepth(depth, meshes);"
- `out`
- `legacyPerformance` — type=bool, default=false

## javaScriptEmitter

Node identifier: javaScriptEmitter.
Supertype: particleEmitterBase.
Concrete attributes (4):
- `array` — type=dynamic, default={"list":[{"value":0,"varType":"double"}]}
- `expression` — type=string, default="var seconds = Math.floor(time / fps);\nif (seconds % 2 == 0) {\n    for (let i = 0; i < 5; i++) {\n        var particle = {};\n        particle.position = {'x': 0, 'y': 0};\n        particle.speed = 10;\n        particle.angle = (time*10)+cavalry.random(-15, 15, time, i);\n        \n        particles.push(particle);\n    }\n}"
- `fps` — type=double
- `time` — type=double

## javaScriptModifier

Node identifier: javaScriptModifier.
Supertype: particleModifier.
Concrete attributes (4):
- `array` — type=dynamic, default={"list":[{"value":0,"varType":"double"}]}
- `expression` — type=string, default="// Define a step size for the particles.\nvar stepSize = 10;\n\n// Calculate the direction change based on the frame.\nvar directionChange = Math.floor(time / 20);\n// For each particle, determine a direction and adjust its position.\nfor (var particle of particles) {\n    // Use the particle's index and direction change as seed to ensure each particle gets a consistent random direction across frames.\n    var seed = particle.uniqueId + directionChange;\n    \n    // Get a random direction (0-5) representing the six directions of the hexagon.\n    var direction = Math.floor(cavalry.uniform(0, 6, seed));\n    // Convert the random direction to an angle (in radians).\n    var angle = cavalry.degreesToRadians(direction * 60);\n    \n    // Determine the movement in x and y based on the angle and step size.\n    var moveX = Math.cos(angle) * stepSize;\n    var moveY = Math.sin(angle) * stepSize;\n\n    // Update the particle's position.\n    particle.position.x += moveX;\n    particle.position.y += moveY;\n}\n"
- `time` — type=double
- `out` — type=particlePoolData

## javaScriptShape

Node identifier: javaScriptShape.
Supertype: shape.
Concrete attributes (2):
- `generator` — type=polyMesh
- `material`

## jsmath

Node identifier: jsmath.
Supertype: mathBase.
Concrete attributes (3):
- `expression` — type=string, default="2+n0"
- `array` — type=list, default={"list":[{}]}
- `out` — type=double

## keyframe

Node identifier: keyframe.
Supertype: molecule.
Concrete attributes (5):
- `frame` — type=int, default=0
- `data` — type=keyData
- `layer` — type=nodeId
- `timeControl` — type=nodeId
- `timeOffset` — type=double, default=0

## keyframeLayer

Node identifier: keyframeLayer.
Supertype: element.
Concrete attributes (4):
- `strength` — type=double, default=100
- `blendMode` — type=enum
- `active` — type=bool, default=true
- `colorId` — default=7

## keyframeLayerFolder

Node identifier: keyframeLayerFolder.
Supertype: hiddenFolder.
Concrete attributes (0):

## kitaokaFilter

Node identifier: kitaokaFilter.
Supertype: filter.
Concrete attributes (17):
- `linesCount` — type=double, default=25
- `lineMode` — type=enum, default=0
- `topLayerMode` — type=enum, default=0
- `midLayerMode` — type=enum, default=1
- `bottomLayerMode` — type=enum, default=0
- `offset` — type=double
- `lineSize` — type=double, default=60
- `greyscaleMode` — type=enum, default=0
- `blendMode` — type=enum, default=1
- `lineWidth` — type=double, default=50
- `thresholdFloor` — type=double, default=0
- `thresholdContrast` — type=double, default=1
- `angle` — type=double, default=0
- `background` — type=color, default={"r":0,"g":0,"b":0,"a":255}
- `topColor` — type=color, default={"r":0,"g":0,"b":0,"a":255}
- `midColor` — type=color, default={"r":126,"g":126,"b":126,"a":255}
- `bottomColor` — type=color, default={"r":255,"g":255,"b":255,"a":255}

## knot

Node identifier: knot.
Supertype: behaviourBase.
Concrete attributes (2):
- `mode` — type=enum, default=0
- `gapWidth` — type=double, default=50

## lattice

Node identifier: lattice.
Supertype: behaviour.
Concrete attributes (9):
- `gridCount` — type=int2, default={"x":3,"y":3}
- `bounds` — type=rect, default={"x":0,"y":0,"width":0,"height":0}
- `controlPointOffsets` — type=list
- `deformers` — type=list
- `controllers` — type=list
- `strength` — type=double, default=100
- `triangulate` — type=bool, default=false
- `meshQuality` — type=enum, default=1
- `meshCustomSpacing` — type=double, default=10

## latticeController

Node identifier: latticeController.
Supertype: atomic.
Concrete attributes (9):
- `controlledPoints` — type=intVector
- `bind` — type=bool, default=true
- `pivotOffset` — type=double2
- `bindOffsets` — type=list
- `position` — type=double2
- `rotation` — type=double, default=0
- `scale` — type=double2, default={"x":1,"y":1}
- `strength` — type=double, default=100
- `out` — type=double2Vector, read-only

## layerSeed

Node identifier: layerSeed.
Supertype: atomic.
Concrete attributes (2):
- `offset` — type=int
- `out` — type=int

## layoutGroup

Node identifier: layoutGroup.
Supertype: layoutGroupBase.
Concrete attributes (10):
- `locked` — default=true
- `spacing` — type=int, default=0
- `spacingMode` — type=enum, default=0
- `direction` — type=enum, default=0
- `orderingPolicy` — type=enum, default=0
- `flipOrder` — type=bool, default=false
- `shuffleSeed` — type=int, default=false
- `wrapMode` — type=enum, default=0
- `alignContent` — type=enum, default=0
- `lineSpacing` — type=int, default=0

## layoutShape

Node identifier: layoutShape.
Supertype: shape.
Tags: beta.
Concrete attributes (4):
- `layout` — type=layoutFunctor
- `resolution` — type=int2
- `layoutItems` — type=list
- `useIndex` — type=bool, default=true

## lengthContext

Node identifier: lengthContext.
Supertype: atomic.
Concrete attributes (2):
- `out` — type=double
- `remapping` — type=nodeId

## levels

Node identifier: levels.
Supertype: filter.
Concrete attributes (9):
- `channel` — type=enum, default=0
- `clipBlack` — type=bool
- `clipWhite` — type=bool
- `inBlack` — type=double, default=0
- `inWhite` — type=double, default=1
- `outBlack` — type=double, default=0
- `outWhite` — type=double, default=1
- `gamma` — type=double, default=1
- `matteApplyMode` — default=1

## linearDistribution

Node identifier: linearDistribution.
Supertype: distribution.
Concrete attributes (4):
- `count` — type=int, default=3
- `size` — type=double, default=200
- `distributionMode` — type=enum, default=0
- `direction` — type=enum, default=0

## linearGradientShader

Node identifier: linearGradientShader.
Supertype: gradientOperator.
Concrete attributes (6):
- `gradient` — type=list
- `scale` — type=double, default=1
- `rotation` — type=double, default=0
- `offset` — type=double2
- `autoSetGradWidth` — type=bool, default=false
- `wrapUVs` — type=bool, default=false

## linearWipe

Node identifier: linearWipe.
Supertype: filter.
Concrete attributes (6):
- `completion` — type=double, default=50
- `feather` — type=double
- `resolution` — type=int2
- `direction` — type=double
- `screenSpace` — type=bool
- `matteApplyMode` — default=1

## lineRectPatternGenerator

Node identifier: lineRectPatternGenerator.
Supertype: rectPatternItem.
Concrete attributes (6):
- `useFixedSize` — type=bool, default=true
- `orientation` — type=enum, default=0
- `size` — type=double2, default={"x":500,"y":100}
- `horizontalAlignment` — type=double, default=0.5
- `gapType` — type=enum, default=1
- `fixedGapWidth` — type=double, default=2

## localTime

Node identifier: localTime.
Supertype: atomic.
Concrete attributes (6):
- `out` — type=double, read-only
- `mode` — type=enum, default=0
- `outputMode` — type=enum, default=0
- `time` — type=int
- `offset` — type=double
- `strength` — type=double, default=100

## logic

Node identifier: logic.
Supertype: mathBase.
Concrete attributes (4):
- `first` — type=bool, default=0
- `second` — type=bool, default=1
- `operation` — type=enum, default=0
- `out` — type=bool, read-only

## lookAt

Node identifier: lookAt.
Supertype: behaviour.
Concrete attributes (3):
- `out`
- `target` — type=nodeId
- `offset` — type=double, default=0

## luminanceBlur

Node identifier: luminanceBlur.
Supertype: filter.
Concrete attributes (7):
- `filterInputCompositing` — default=1
- `maxBlurAmount` — type=double, default=20
- `minBlurAmount` — type=double, default=0
- `invertLuminance` — type=bool, default=false
- `tileMode` — type=enum, default=2
- `controlShape` — type=nodeId
- `debugMode` — type=enum, default=0

## magneticModifier

Node identifier: magneticModifier.
Supertype: particlePhysicsModifier.
Concrete attributes (4):
- `physicsMode` — type=enum, default=0
- `customColor` — type=bool
- `drawColor` — type=color, default={"r":233,"g":21,"b":41,"a":255}
- `forceMagnitude` — type=double, default=10

## manipulateArray

Node identifier: manipulateArray.
Supertype: arrayOperator.
Concrete attributes (1):
- `mode` — type=enum, default=0

## manipulator

Node identifier: manipulator.
Supertype: behaviour.
Concrete attributes (5):
- `out`
- `position` — type=double2
- `rotation` — type=double
- `scale` — type=double2, default={"x":1,"y":1}
- `pivot` — type=double2

## maskBlurFilter

Node identifier: maskBlurFilter.
Supertype: filter.
Concrete attributes (3):
- `filterInputCompositing` — default=1
- `amount` — type=double, default=10
- `blurStyle` — type=enum, default=0

## maskDistribution

Node identifier: maskDistribution.
Supertype: distribution.
Concrete attributes (2):
- `input` — type=nodeId
- `masks` — type=list

## materialBehaviourAlpha

Node identifier: materialBehaviourAlpha.
Supertype: materialBehaviourBase.
Concrete attributes (2):
- `alpha` — type=double, default=100
- `out`

## materialBehaviourColor

Node identifier: materialBehaviourColor.
Supertype: materialBehaviourBase.
Concrete attributes (2):
- `materialColor` — type=color, default={"r":100,"g":100,"b":100}
- `out`

## materialBehaviourHSV

Node identifier: materialBehaviourHSV.
Supertype: materialBehaviourBase.
Concrete attributes (4):
- `adjustHue` — type=double, default=0
- `adjustSaturation` — type=double, default=0
- `adjustValue` — type=double, default=0.5
- `out`

## materialBehaviourSwapColor

Node identifier: materialBehaviourSwapColor.
Supertype: materialBehaviourBase.
Concrete attributes (3):
- `oldColor` — type=color, default={"r":100,"g":100,"b":100}
- `newColor` — type=color, default={"r":244,"g":138,"b":45}
- `out`

## materialSampler

Node identifier: materialSampler.
Supertype: behaviour.
Concrete attributes (5):
- `value` — type=double, default=1
- `inputShape` — type=nodeId
- `out`
- `graph` — type=list
- `offset` — type=double, default=0

## math

Node identifier: math.
Supertype: mathBase.
Concrete attributes (4):
- `first` — type=double, default=0
- `second` — type=double, default=1
- `operation` — type=enum, default=2
- `out` — type=double, read-only

## math2

Node identifier: math2.
Supertype: mathBase.
Concrete attributes (4):
- `first` — type=double2, default={"x":0,"y":0}
- `second` — type=double2, default={"x":0,"y":0}
- `operation` — type=enum, default=0
- `out` — type=double2, read-only

## math3

Node identifier: math3.
Supertype: mathBase.
Concrete attributes (4):
- `first` — type=double3, default={"x":0,"y":0,"z":0}
- `second` — type=double3, default={"x":0,"y":0,"z":0}
- `operation` — type=enum, default=0
- `out` — type=double3, read-only

## mathDistribution

Node identifier: mathDistribution.
Supertype: distribution.
Concrete attributes (3):
- `count` — type=int, default=12
- `expression` — type=string, default="x := cos(i * 2 * pi / count) * 200;\ny := sin(i * 2 * pi / count) * 200;"
- `array` — type=list

## measure

Node identifier: measure.
Supertype: atomic.
Concrete attributes (4):
- `target` — type=nodeId
- `secondTarget` — type=nodeId
- `out` — type=double, read-only
- `mode` — type=enum, default=0

## measureText

Node identifier: measureText.
Supertype: atomic.
Concrete attributes (9):
- `string` — type=string, default="Cavalry"
- `fontSize` — type=double, default=72
- `font` — type=font
- `fontAxes` — type=list
- `typeface` — type=typeface
- `textBoxSize` — type=double2, default={"x":600,"y":300}
- `allowWordBreaks` — type=bool, default=true
- `textSize` — type=double2
- `fontScale` — type=double

## mergeShape

Node identifier: mergeShape.
Supertype: shape.
Concrete attributes (6):
- `firstInputShape` — type=nodeId
- `secondInputShape` — type=nodeId
- `reverseSecondShape` — type=bool
- `stroke`
- `material`
- `mergeHelp` — type=bool, default=true

## meshBehaviour

Node identifier: meshBehaviour.
Supertype: behaviourBase.
Concrete attributes (2):
- `direction` — type=double2
- `out`

## meshDistribution

Node identifier: meshDistribution.
Supertype: distribution.
Concrete attributes (10):
- `inputShape` — type=nodeId
- `count` — type=int, default=3
- `fill` — type=bool, default=true
- `scaleToFit` — type=bool, default=true
- `ignoreEmptySubMeshes` — type=bool, default=true
- `scaleMultiplier` — type=double, default=1
- `keepAspectRatio` — type=bool, default=true
- `levelMode` — type=enum
- `level` — type=int, default=1
- `useLevels` — type=bool, default=false

## meshShape

Node identifier: meshShape.
Supertype: shape.
Concrete attributes (12):
- `material`
- `size` — type=double2, default={"x":400,"y":400}
- `mesh` — type=bool, default=true
- `meshVertex` — type=list
- `controlPaths` — type=list
- `edges` — type=int2Vector
- `bottomLeftOffset` — type=double2
- `bottomRightOffset` — type=double2
- `topRightOffset` — type=double2
- `topLeftOffset` — type=double2
- `highQualityTriangulation` — type=bool
- `meshControllerFalloffs` — type=list

## meshSolver

Node identifier: meshSolver.
Supertype: behaviourBase.
Concrete attributes (10):
- `time` — type=int, default=0
- `startFrame` — type=int, default=0
- `preRollIterations` — type=int, default=0
- `feedbackMode` — type=enum, default=0
- `levelMode` — type=enum, default=0
- `level` — type=int, default=0
- `deformers` — type=list
- `keepPreviousMeshes` — type=int, default=0
- `reverseOrder` — type=bool, default=false
- `out`

## mirrorFilter

Node identifier: mirrorFilter.
Supertype: filter.
Concrete attributes (9):
- `offset` — type=double2
- `padding` — type=double, default=0
- `screenSpace` — type=bool, default="false"
- `resolution` — type=int2
- `tiling` — type=enum
- `rotation` — type=double
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=29
- `matteApplyMode` — default=1

## modulate

Node identifier: modulate.
Supertype: behaviour.
Concrete attributes (8):
- `value` — type=double, default=5
- `modulateMode` — type=enum, default=0
- `indexOffset` — type=double, default=0
- `offset` — type=double, default=0
- `passValue` — type=double, default=1
- `failValue` — type=double, default=0
- `customPattern` — type=string, default="1,1,5,5,2,2,10,10"
- `out`

## morph

Node identifier: morph.
Supertype: behaviour.
Concrete attributes (6):
- `out`
- `target` — type=nodeId
- `quality` — type=int, default=2
- `samplingOffset` — type=int, default=0
- `mode` — type=enum
- `strength` — type=double, default=100

## motionBlurFilter

Node identifier: motionBlurFilter.
Supertype: filter.
Concrete attributes (6):
- `filterInputCompositing` — default=1
- `strength` — type=double, default=100
- `blendMode` — type=enum, default=1
- `blurCentre` — type=double, default=0
- `samples` — type=int, default=16
- `highQualitySamples` — type=bool, default=false

## motionStretch

Node identifier: motionStretch.
Supertype: behaviour.
Tags: beta.
Concrete attributes (3):
- `threshold` — type=double, default=0
- `deformers` — type=list
- `out`

## multiPointGradientShader

Node identifier: multiPointGradientShader.
Supertype: shader.
Concrete attributes (5):
- `point` — type=list
- `blendMode` — type=enum, default=3
- `alpha` — type=double, default=100
- `premultiply` — type=bool, default=true
- `gradientMode` — type=enum, default=0

## noise

Node identifier: noise.
Supertype: behaviour.
Concrete attributes (4):
- `out`
- `generator` — type=nodeId
- `useNormals` — type=bool, default=0
- `strengthToZero` — type=bool, default=true

## noiseShader

Node identifier: noiseShader.
Supertype: shader.
Concrete attributes (23):
- `resolution` — type=int2, default={"x":1024,"y":1024}
- `scale` — type=double2, default={"x":1,"y":1}
- `offset` — type=double2, default={"x":0,"y":0}
- `minimum` — type=double, default=0
- `maximum` — type=double, default=1
- `gamma` — type=double, default=1
- `time` — type=double
- `fps` — type=double
- `timeScale` — type=double, default=0.1
- `frequency` — type=double, default=2
- `cycles` — type=double, default=0
- `octaves` — type=int, default=5
- `lacunarity` — type=double, default=2.5
- `gain` — type=double, default=0.5
- `amplitude` — type=double, default=1
- `noiseShaderType` — type=enum, default=0
- `turbulentNoise` — type=bool, default=false
- `blendMode` — type=enum, default=3
- `fracMode` — type=enum, default=0
- `ridgeOffset` — type=double, default=0.8
- `curlEnabled` — type=bool, default=false
- `epsilonScale` — type=double, default=1
- `alpha` — type=double, default=100

## normalizePathUtility

Node identifier: normalizePathUtility.
Supertype: behaviourBase.
Concrete attributes (2):
- `outerContours` — type=enum
- `skipOpenContours` — type=bool, default=true

## null

Node identifier: null.
Supertype: drawable.
Concrete attributes (15):
- `customColor` — type=bool
- `nullColor` — type=color, default={"r":58,"g":174,"b":240,"a":255}
- `positionLimitMin` — type=double2, default={"x":-250,"y":-250}
- `positionLimitMax` — type=double2, default={"x":250,"y":250}
- `scaleLimitMin` — type=double2, default={"x":1,"y":1}
- `scaleLimitMax` — type=double2, default={"x":2,"y":2}
- `rotationLimitMin` — type=double
- `rotationLimitMax` — type=double, default=360
- `rotationLimit` — type=bool
- `scaleLimit` — type=bool
- `positionLimit` — type=bool
- `drawPositionLimit` — type=bool, default=false
- `shape` — type=enum, default=0
- `is3d` — type=bool, default=false
- `hidden` — type=bool, default=false

## numberRange

Node identifier: numberRange.
Supertype: behaviourBase.
Tags: Remap.
Concrete attributes (9):
- `out`
- `sourceMin` — type=double, default=0
- `sourceMax` — type=double, default=10
- `min` — type=double, default=0
- `max` — type=double, default=100
- `value` — type=double, default=0
- `offset` — type=double, default=0
- `graph` — type=list
- `clampValues` — type=bool, default=true

## numberRangeBase

Node identifier: numberRangeBase.
Supertype: remapper.
Tags: Remap.
Concrete attributes (8):
- `out`
- `sourceMin` — type=double, default=0
- `sourceMax` — type=double, default=10
- `min` — type=double, default=0
- `max` — type=double, default=100
- `offset` — type=double, default=0
- `graph` — type=list
- `clampValues` — type=bool, default=true

## numberRangeToColor

Node identifier: numberRangeToColor.
Supertype: behaviourBase.
Tags: Remap.
Concrete attributes (6):
- `out`
- `sourceMin` — type=double, default=0
- `sourceMax` — type=double, default=10
- `gradient` — type=list
- `value` — type=double, default=0
- `clampValues` — type=bool, default=true

## numberRangeToColorBase

Node identifier: numberRangeToColorBase.
Supertype: remapper.
Tags: Remap.
Concrete attributes (5):
- `out`
- `sourceMin` — type=double, default=0
- `sourceMax` — type=double, default=10
- `gradient` — type=list
- `clampValues` — type=bool, default=true

## oscillator

Node identifier: oscillator.
Supertype: behaviour.
Concrete attributes (18):
- `minimum` — type=double, default=-10
- `maximum` — type=double, default=10
- `frequency` — type=double, default=5
- `separateChannels` — type=bool
- `offset` — type=double
- `stagger` — type=double, default=20
- `time` — type=double
- `timeOffset` — type=double
- `numberOfWaves` — type=double, default=10
- `timeScale` — type=double, default=1
- `trigType` — type=enum, default=0
- `waveType` — type=enum, default=0
- `timeMode` — type=enum, default=0
- `useNormals` — type=bool, default=0
- `fps` — type=double
- `graph` — type=list
- `out`
- `strengthToZero` — type=bool, default=true

## oscillatorLegacy

Node identifier: oscillatorLegacy.
Supertype: behaviour.
Concrete attributes (13):
- `minimum` — type=double, default=-10
- `maximum` — type=double, default=10
- `frequency` — type=double, default=10
- `separateChannels` — type=bool
- `offset` — type=double
- `stagger` — type=double
- `time` — type=double
- `timeScale` — type=double, default=1
- `trigType` — type=enum, default=0
- `waveType` — type=enum, default=0
- `useNormals` — type=bool, default=0
- `out`
- `strengthToZero` — type=bool, default=true

## outline

Node identifier: outline.
Supertype: shape.
Concrete attributes (18):
- `material`
- `inputShape` — type=list
- `width` — type=double, default=10
- `offset` — type=double, default=0
- `preserveMaterials` — type=bool
- `preserveMaterialsHelp` — type=bool, default=true
- `joinStyle` — type=enum, default=0
- `capStyle` — type=enum, default=0
- `align` — type=enum, default=0
- `cleanUp` — type=bool, default=false
- `miter` — type=double, default=10
- `dashPattern` — type=string
- `dashOffset` — type=double, default=0
- `trim` — type=bool, default=false
- `trimStart` — type=double, default=0
- `trimEnd` — type=double, default=100
- `trimTravel` — type=double, default=0
- `reversePath` — type=bool, default=false

## palette

Node identifier: palette.
Supertype: none.
Concrete attributes (0):

## paletteContainer

Node identifier: paletteContainer.
Supertype: none.
Concrete attributes (0):

## particleDistribution

Node identifier: particleDistribution.
Supertype: distribution.
Concrete attributes (1):
- `inputShape` — type=nodeId

## particleEmitter

Node identifier: particleEmitter.
Supertype: particleEmitterBase.
Concrete attributes (21):
- `emitterShape` — type=enum, default=1
- `directionType` — type=enum, default=0
- `emitterType` — type=enum, default=0
- `emitterRate` — type=double, default=100
- `directionsHelp` — type=bool, default=true
- `particlesPerPixel` — type=double, default=0.5
- `interval` — type=double, default=0
- `duration` — type=double, default=1
- `probability` — type=double, default=100
- `initialDirection` — type=double, default=0
- `initialSpeed` — type=double, default=10
- `useEmitterVelocity` — type=bool, default="false"
- `emitterVelocityStrength` — type=double, default=20
- `normalAngle` — type=double
- `usePathNormals` — type=bool, default="false"
- `perimeterMargin` — type=double, default=0
- `seed` — type=int, default=0
- `inputShape` — type=nodeId
- `size` — type=double2, default={"x":200,"y":200}
- `singlePos` — type=bool, default=false
- `triangulatedData` — type=triangulatedPathData

## particleShape

Node identifier: particleShape.
Supertype: shape.
Tags: beta, particles.
Concrete attributes (47):
- `inputShape` — type=nodeId
- `triangulatedData` — type=triangulatedPathData
- `atlasData` — type=atlasData
- `imageQuality` — type=enum, default=0
- `inputImage` — type=assetId, default=""
- `loopSequence` — type=bool, default=false
- `compStartFrame` — type=int
- `sequenceMode` — type=enum, default=1
- `compSize` — type=int2
- `imageIndexOffset` — type=int, default=0
- `fitToLifespan` — type=bool, default=true
- `particleRadius` — type=double, default=4
- `fps` — type=double
- `lifespan` — type=double, default=5
- `emitters` — type=list
- `modifiers` — type=list
- `colorOverLifespan` — type=list
- `rotationScalar` — type=list
- `rotationOverLifespan` — type=double, default=360
- `scaleOverLifespan` — type=list
- `generator` — type=nodeId
- `scaleStrength` — type=double, default=100
- `dragForce` — type=double, default=5
- `gravity` — type=double2, default={"x":180,"y":9.8}
- `mass` — type=double, default=5
- `startRotation` — type=double, default=0
- `seed` — type=int
- `turbulence` — type=double, default=0
- `worldScale` — type=double, default=50
- `gradientMode` — type=enum
- `shapeStyle` — type=enum, default=1
- `out` — type=particleShapeData
- `time` — type=double
- `compFps` — type=double
- `startFrame` — type=int, default=0
- `timeStep` — type=enum, default=0
- `colorMode` — type=enum, default=1
- `particleColor` — type=color, default={"r":79,"g":253,"b":122,"a":255}
- `validAtlas` — type=bool, default=true
- `scaleMode` — type=enum, default=0
- `isCaching` — type=bool, default=false
- `useCache` — type=bool, default=false
- `cacheFilePath` — type=string
- `cache` — type=particleSolverData
- `imageBlendModeHelp` — type=bool, default=true
- `imageBlendMode` — type=enum, default=3
- `numberOfParticles` — type=int

## pathAverage

Node identifier: pathAverage.
Supertype: behaviour.
Concrete attributes (3):
- `iterations` — type=int, default=1
- `cutoffFrequency` — type=double, default=0.2
- `out`

## pathDistribution

Node identifier: pathDistribution.
Supertype: distribution.
Concrete attributes (9):
- `mode` — type=enum, default=1
- `count` — type=int, default=3
- `inputShape` — type=nodeId
- `travel` — type=double, default=0
- `offset` — type=double, default=0
- `length` — type=double, default=100
- `flip` — type=bool
- `excludeEnd` — type=bool
- `calculateRotations` — type=bool, default=true

## pathField

Node identifier: pathField.
Supertype: dynamicField.
Concrete attributes (11):
- `pathToFollow` — type=nodeId
- `captureForce` — type=double, default=1
- `flowForce` — type=double, default=1
- `captureMargin` — type=double, default=200
- `flowMargin` — type=double, default=100
- `flowVariance` — type=double, default=20
- `drawCaptureMargin` — type=bool, default=true
- `drawFlowMargin` — type=bool, default=true
- `captureGraph` — type=list
- `flowGraph` — type=list
- `velocityDamping` — type=double, default=0.25

## pathfinder

Node identifier: pathfinder.
Supertype: behaviourBase.
Concrete attributes (12):
- `travel` — type=double, default=0
- `inputShape` — type=nodeId
- `out`
- `strength` — type=double, default=100
- `graph` — type=list
- `pathOffset` — type=double, default=0
- `pathSpace` — type=bool, default=false
- `flip` — type=bool, default=false
- `reversePath` — type=bool, default=false
- `loop` — type=bool, default=true
- `rotation` — type=double, default=0
- `rotationOffset` — type=double, default=0

## pathLength

Node identifier: pathLength.
Supertype: atomic.
Concrete attributes (4):
- `inputShape` — type=nodeId
- `strength` — type=double, default=100
- `offset` — type=double
- `out` — type=double, read-only

## pathModifier

Node identifier: pathModifier.
Supertype: particlePhysicsModifier.
Concrete attributes (16):
- `captureForce` — type=double, default=50
- `flowForce` — type=double, default=100
- `physicsMode` — type=enum, default=0
- `pathToFollow` — type=nodeId
- `captureMargin` — type=double, default=250
- `flowMargin` — type=double, default=100
- `flowVariance` — type=double, default=20
- `drawFlowMarginIndicator` — type=bool, default=true
- `drawCaptureMarginIndicator` — type=bool, default=true
- `lookAhead` — type=double, default=5
- `captureGraph` — type=list
- `flowGraph` — type=list
- `customColor` — type=bool
- `drawColor` — type=color, default={"r":58,"g":174,"b":240,"a":255}
- `time` — type=double
- `out` — type=particlePoolData

## pathOffsetBehaviour

Node identifier: pathOffsetBehaviour.
Supertype: behaviourBase.
Concrete attributes (5):
- `offset` — type=double, default=0
- `rounded` — type=bool, default=false
- `visitContours` — type=bool, default=false
- `closedPathMode` — type=enum, default=0
- `openPathMode` — type=enum, default=2

## pathRelax

Node identifier: pathRelax.
Supertype: behaviour.
Concrete attributes (4):
- `iterations` — type=int, default=1
- `radius` — type=double, default=50
- `relaxationStrength` — type=double, default=1
- `out`

## pathSplit

Node identifier: pathSplit.
Supertype: behaviour.
Concrete attributes (18):
- `mode` — type=enum, default=0
- `iterations` — type=int, default=3
- `preventReSplit` — type=bool, default=true
- `maxTotalBranches` — type=int, default=100
- `splitCondition` — type=enum, default=1
- `splitLength` — type=double, default=100
- `splitProbability` — type=double, default=0.3
- `splitSeed` — type=int, default=0
- `splitCurvatureAngle` — type=double, default=45
- `branchType` — type=enum, default=0
- `branchAngle` — type=double, default=45
- `branchLength` — type=double, default=50
- `branchArcRadius` — type=double, default=50
- `branchArcSweepAngle` — type=double, default=45
- `branchArcDirection` — type=enum, default=0
- `branchBezierLength` — type=double, default=50
- `branchCurvature` — type=double, default=0.5
- `out`

## patternShape

Node identifier: patternShape.
Supertype: shape.
Concrete attributes (7):
- `stroke`
- `size` — type=int2, default={"x":100,"y":100}
- `useCompResolution` — type=bool, default=false
- `resolution` — type=int2
- `angle` — type=double, default=45
- `count` — type=int, default=10
- `width` — type=double, default=5

## pieChart

Node identifier: pieChart.
Supertype: chartEngine.
Concrete attributes (11):
- `column` — type=double
- `file` — type=assetId
- `radius` — type=double, default=400
- `innerRadius` — type=double, default=0
- `angle` — type=double, default=360
- `gap` — type=double, default=0
- `cornerRadius` — type=double, default=0
- `automaticColors` — type=bool, default=true
- `dataType` — type=enum, default=0
- `angleMode` — type=enum, default=0
- `minimumSliceAngle` — type=double, default=0

## pinch

Node identifier: pinch.
Supertype: behaviourBase.
Concrete attributes (4):
- `bindFalloff` — type=nodeId
- `active` — type=bool, default=true
- `strength` — type=double, default=100
- `mover` — type=nodeId

## pinConstraint

Node identifier: pinConstraint.
Supertype: forgeConstraint.
Concrete attributes (16):
- `motor` — type=bool, default=false
- `motorSpeed` — type=double, default=360
- `maxMotorTorque` — type=double, default=20
- `enableLimit` — type=bool, default=false
- `limits` — type=double2
- `tension` — type=double, default=0
- `dampingRatio` — type=double, default=0.5
- `verticalAlignment` — type=double, default=0
- `horizontalAlignment` — type=double, default=0
- `breakable` — type=bool, default=false
- `breakingForce` — type=double, default=0.25
- `breakingMode` — type=enum, default=0
- `stretchLimit` — type=double, default=5
- `breakingDuration` — type=int, default=20
- `stressThreshold` — type=double, default=10
- `reportStress` — type=bool, default=false

## pixelateFilter

Node identifier: pixelateFilter.
Supertype: filter.
Concrete attributes (6):
- `filterInputCompositing` — default=1
- `size` — type=int, default=30
- `outline` — type=double, default=1
- `borderColor` — type=color, default={"r":255,"g":255,"b":255,"a":255}
- `leadingDiagonal` — type=bool, default=true
- `pixelType` — type=enum, default=0

## pixelSortingFilter

Node identifier: pixelSortingFilter.
Supertype: filter.
Concrete attributes (9):
- `filterInputCompositing` — default=1
- `detail` — type=int, default=32
- `pixelMasks` — type=list
- `threshold` — type=double, default=0.25
- `reverseSort` — type=bool
- `direction` — type=enum, default=0
- `sortMode` — type=enum, default=0
- `blendMode` — type=enum, default=3
- `opacity` — type=double, default=100

## planarCamera

Node identifier: planarCamera.
Supertype: drawable.
Concrete attributes (16):
- `position` — type=double3, default={"x":0,"y":0,"z":879.13}
- `positionOffset` — type=double3, default={"x":0,"y":0,"z":0}
- `rotation` — type=double3
- `lookAt` — type=double3
- `lookAtOffset` — type=double3
- `zoom` — type=double, default=879.13
- `cameraType` — type=enum, default=1
- `out` — type=3dTransform
- `fog` — type=bool, default=false
- `fogColor` — type=color, default={"r":255,"g":255,"b":255,"a":255}
- `fogRange` — type=double2, default={"x":750,"y":1500}
- `blur` — type=bool, default=false
- `blurRange` — type=double2, default={"x":750,"y":1500}
- `blurAmount` — type=double, default=20
- `inputGuides` — type=list
- `resolution` — type=int2

## pointConstraint

Node identifier: pointConstraint.
Supertype: constraintOperator.
Concrete attributes (7):
- `target` — type=nodeId
- `offset` — type=double2
- `index` — type=int
- `strength` — type=double, default=100
- `rotationStrength` — type=double, default=100
- `normalBias` — type=double
- `outRotation` — type=double, read-only

## pointDisplace

Node identifier: pointDisplace.
Supertype: behaviour.
Concrete attributes (5):
- `displacement` — type=double, default=10
- `direction` — type=enum, default=0
- `angle` — type=double, default=0
- `frequency` — type=int, default=0
- `out`

## pointDistribution

Node identifier: pointDistribution.
Supertype: distribution.
Concrete attributes (1):
- `count` — type=int, default=3

## pointsToCurve

Node identifier: pointsToCurve.
Supertype: shape.
Concrete attributes (4):
- `generator` — type=nodeId
- `close` — type=bool, default=false
- `bezier` — type=bool, default=true
- `stroke`

## pointToVector

Node identifier: pointToVector.
Supertype: shape.
Concrete attributes (3):
- `distribution` — type=nodeId
- `shapeColor` — type=color
- `closePath` — type=bool

## polygonShape

Node identifier: polygonShape.
Supertype: primitive.
Concrete attributes (3):
- `divisions` — type=int, default=0
- `radius` — type=double2, default={"x":100,"y":100}
- `sides` — type=int, default=5

## positionBlend

Node identifier: positionBlend.
Supertype: behaviour.
Concrete attributes (3):
- `out`
- `firstValue` — type=double3
- `secondValue` — type=double3

## posterizeFilter

Node identifier: posterizeFilter.
Supertype: filter.
Concrete attributes (4):
- `matteApplyMode` — default=1
- `levels` — type=int, default=4
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=3

## pushAlongVector

Node identifier: pushAlongVector.
Supertype: behaviour.
Concrete attributes (4):
- `out`
- `direction` — type=double2
- `useNormals` — type=bool, default=false
- `reverseDirection` — type=bool, default=false

## quadTreeShape

Node identifier: quadTreeShape.
Supertype: shape.
Concrete attributes (5):
- `material`
- `stroke`
- `generator` — type=nodeId
- `maxIterations` — type=int, default=5
- `size` — type=double2, default={"x":500,"y":500}

## radialGradientShader

Node identifier: radialGradientShader.
Supertype: gradientOperator.
Concrete attributes (9):
- `gradient` — type=list
- `rotation` — type=double, default=0
- `radius` — type=double, default=100
- `offset` — type=double2
- `radiusMode` — type=enum, default=1
- `radiusRatio` — type=double, default=1
- `wrapUVs` — type=bool, default=false
- `scale` — type=double2, default={"x":100,"y":100}
- `legacyRotation` — type=bool, default=false

## radialWipe

Node identifier: radialWipe.
Supertype: filter.
Concrete attributes (8):
- `completion` — type=double, default=25
- `startAngle` — type=double, default=0
- `feather` — type=double
- `wipeCenter` — type=double2
- `wipeMode` — type=enum, default=1
- `screenSpace` — type=bool
- `resolution` — type=int2
- `matteApplyMode` — default=1

## radius

Node identifier: radius.
Supertype: atomic.
Concrete attributes (8):
- `radiusData` — type=radiusData, read-only
- `centrePosition` — type=double2, read-only
- `expand` — type=double2
- `radius` — type=double2, read-only
- `innerRadius` — type=double2, read-only
- `inputShapes` — type=list
- `centreMode` — type=enum, default=0
- `centre` — type=double2

## random

Node identifier: random.
Supertype: behaviour.
Concrete attributes (12):
- `minimum` — type=double
- `maximum` — type=double, default=10
- `seed` — type=int
- `useLayerAsSeed` — type=bool, default=false
- `offset` — type=double
- `separateChannels` — type=bool
- `useGraph` — type=bool
- `graph` — type=list
- `out`
- `useIndex` — type=bool, default=true
- `useNormals` — type=bool, default=0
- `strengthToZero` — type=bool, default=true

## randomDistribution

Node identifier: randomDistribution.
Supertype: distribution.
Concrete attributes (11):
- `shapeType` — type=enum, default=0
- `size` — type=double2, default={"x":500,"y":500}
- `count` — type=int, default=50
- `seed` — type=int, default=1000
- `relaxMode` — type=bool, default=false
- `relaxDistance` — type=double, default=10
- `maxRelaxIterations` — type=int, default=10
- `keepShape` — type=bool, default=false
- `useProbability` — type=bool, default=false
- `probability` — type=double, default=1
- `threshold` — type=double2, default={"x":0.5,"y":1}

## rangeFalloff

Node identifier: rangeFalloff.
Supertype: atomic.
Concrete attributes (13):
- `out` — type=doubleVector
- `indices` — type=string, default="first,last"
- `strength` — type=double, default=100
- `indexOffset` — type=int, default=0
- `start` — type=double, default=25
- `end` — type=double, default=75
- `percentageOffset` — type=double, default=0
- `transitionSize` — type=int, default=10
- `transitionCompletion` — type=double, default=0
- `mode` — type=enum
- `invert` — type=bool, default=false
- `useGraph` — type=bool, default=false
- `graph` — type=list

## rayLine

Node identifier: rayLine.
Supertype: shape.
Concrete attributes (7):
- `resolution` — type=int2
- `shapes` — type=list
- `stroke`
- `collisionMargin` — type=double, default=0
- `bidirectional` — type=bool, default=true
- `border` — type=double2
- `divisions` — type=int, default=10

## rectangleShape

Node identifier: rectangleShape.
Supertype: primitive.
Concrete attributes (9):
- `vectorize` — type=bool
- `divisions` — type=int, default=8
- `dimensions` — type=double2, default={"x":200,"y":200}
- `radiusMode` — type=enum, default=0
- `chamfer` — type=bool
- `cornerRadius` — type=double, default=0
- `radiusTop` — type=double2, default={"x":5,"y":5}
- `radiusBottom` — type=double2, default={"x":5,"y":5}
- `edgeDivisions` — type=int2, default={"x":0,"y":0}

## rectPatternShape

Node identifier: rectPatternShape.
Supertype: shape.
Concrete attributes (5):
- `material`
- `generator` — type=rectPatternFunctor
- `count` — type=int, default=20
- `barWidth` — type=double, default=25
- `useIndex` — type=bool, default=true

## regexString

Node identifier: regexString.
Supertype: stringOperator.
Concrete attributes (2):
- `regex` — type=string, default="a+"
- `captureGroupIndices` — type=string, default=""

## removeContoursUtility

Node identifier: removeContoursUtility.
Supertype: behaviourBase.
Concrete attributes (2):
- `removeClockwise` — type=bool, default=false
- `removeCounterclockwise` — type=bool, default=false

## renderAPNG

Node identifier: renderAPNG.
Supertype: renderFormat.
Concrete attributes (1):
- `looping` — type=bool, default=true

## renderAudioOnly

Node identifier: renderAudioOnly.
Supertype: renderFormatWithAudio.
Concrete attributes (3):
- `format` — type=enum, default=0
- `bitDepth` — type=enum, default=0
- `audioQuality`

## renderGIF

Node identifier: renderGIF.
Supertype: renderFormat.
Concrete attributes (4):
- `quality` — type=enum, default=4
- `alpha` — type=bool
- `dithering` — type=bool, default=true
- `alphaThreshold` — type=int, default=128

## renderHVEC

Node identifier: renderHVEC.
Supertype: renderFormatWithAudio.
Concrete attributes (6):
- `qualityMode` — type=enum, default=1
- `bitratePresets` — type=enum, default=2
- `bitrate` — type=double, default=5
- `crf` — type=int, default=50
- `encodingMode` — type=enum, default=2
- `audioProHelp` — type=bool, default=true

## renderJPEG

Node identifier: renderJPEG.
Supertype: renderFormat.
Concrete attributes (1):
- `quality` — type=int, default=100

## renderLottie

Node identifier: renderLottie.
Supertype: renderFormat.
Concrete attributes (0):

## renderMP4

Node identifier: renderMP4.
Supertype: renderFormatWithAudio.
Concrete attributes (6):
- `qualityMode` — type=enum, default=1
- `mp4Quality` — type=enum, default=2
- `mp4Bitrate` — type=double, default=12
- `audioProHelp` — type=bool, default=true
- `crf` — type=int, default=70
- `encodingMode` — type=enum, default=2

## renderPNG

Node identifier: renderPNG.
Supertype: renderFormat.
Concrete attributes (4):
- `compression` — type=int, default=0
- `bitDepth` — type=enum, default=0
- `pngFilter` — type=enum, default=1
- `alpha` — type=bool, default=false

## renderProRes

Node identifier: renderProRes.
Supertype: renderFormatWithAudio.
Concrete attributes (1):
- `codec` — type=enum, default=1

## renderQueue

Node identifier: renderQueue.
Supertype: none.
Concrete attributes (0):

## renderQueueItem

Node identifier: renderQueueItem.
Supertype: element.
Concrete attributes (31):
- `compId` — type=string
- `showInProjectWindow` — default=false
- `targets` — type=list
- `selected` — type=bool, default=true
- `ensureUniqueNames` — type=bool, default=true
- `usePlaybackStep` — type=bool, default=true
- `fileName` — type=string
- `generator` — type=nodeId
- `padding` — type=int, default=5
- `frameRange` — type=int2, default={"x":0,"y":250}
- `frameRangeMode` — type=enum, default=1
- `filePath` — type=string
- `resolutionScale` — type=double, default=100
- `dynamicRender` — type=bool, default=false
- `dynamicIndex` — type=int, default=0, read-only
- `dynamicRenderCount` — type=int, default=1
- `dynamicRenderRange` — type=int2, default={"x":0,"y":0}
- `dynamicIndexOffset` — type=int, default=0
- `backend` — type=enum, default=1
- `renderQuality` — type=enum, default=0
- `renderSetupExpression` — type=string, default=""
- `preRenderExpression` — type=string, default=""
- `postRenderExpression` — type=string, default=""
- `respectViewportFiltering` — type=bool, default=false
- `enableMetadata` — type=bool, default=false
- `canvaUpload` — type=bool, default=false
- `metadata` — type=list
- `metaDataFormat` — type=enum, default=0
- `upload` — type=bool, default=false
- `uploadPreset` — type=string
- `retimeHelp` — type=bool, default=true

## renderQuicktime

Node identifier: renderQuicktime.
Supertype: renderFormatWithAudio.
Concrete attributes (7):
- `codec` — type=enum, default=2
- `jpegQuality` — type=int, default=70
- `proResCodec` — type=enum, default=1
- `bitDepth` — type=enum, default=0
- `audioFormat` — type=enum, default=0
- `audioQuality`
- `audioProHelp` — type=bool, default=true

## renderSpriteSheet

Node identifier: renderSpriteSheet.
Supertype: renderFormat.
Concrete attributes (7):
- `compression` — type=int, default=0
- `pngFilter` — type=enum, default=1
- `alpha` — type=bool, default=true
- `margin` — type=int, default=1
- `gap` — type=int, default=1
- `automaticMetadata` — type=bool, default=true
- `maximumSize` — type=int2, default={"x":2048,"y":2048}

## renderSVG

Node identifier: renderSVG.
Supertype: renderFormat.
Concrete attributes (1):
- `includeBackground` — type=bool, default=false

## renderWebM

Node identifier: renderWebM.
Supertype: renderFormatWithAudio.
Concrete attributes (6):
- `codec` — type=enum, default=0
- `quality` — type=enum, default=2
- `bitrate` — type=double, default=4
- `audioProHelp` — type=bool, default=true
- `qualityMode` — type=enum, default=1
- `crf` — type=int, default=50

## renderWebP

Node identifier: renderWebP.
Supertype: renderFormat.
Concrete attributes (1):
- `quality` — type=int, default=100

## replaceString

Node identifier: replaceString.
Supertype: stringOperator.
Concrete attributes (2):
- `replace` — type=string, default="ry"
- `with` — type=string, default="cade"

## resamplePath

Node identifier: resamplePath.
Supertype: behaviourBase.
Concrete attributes (7):
- `mergeOverlaps` — type=bool, default=true
- `mode` — type=enum, default=0
- `resampleAsBeziers` — type=bool, default=false
- `cornerAngle` — type=double, default=0
- `simplifyPath` — type=bool, default=true
- `simplifyDistance` — type=double, default=10
- `out`

## resizeArray

Node identifier: resizeArray.
Supertype: arrayOperator.
Concrete attributes (1):
- `size` — type=int, default=10

## resizeString

Node identifier: resizeString.
Supertype: stringOperator.
Concrete attributes (10):
- `percentage` — type=double, default=50
- `length` — type=int, default=5
- `mode` — type=enum, default=0
- `eraseFromStart` — type=bool, default=false
- `directionMode` — type=enum, default=1
- `indexMode` — type=enum, default=0
- `matchMode` — type=enum, default=2
- `regex` — type=string, default="[0-9]+"
- `captureGroupIndices` — type=string, default=""
- `randomSeed` — type=int, default=1

## reversePathUtility

Node identifier: reversePathUtility.
Supertype: behaviourBase.
Concrete attributes (1):
- `mode` — type=enum

## rgbSplitFilter

Node identifier: rgbSplitFilter.
Supertype: filter.
Concrete attributes (15):
- `red` — type=color, default={"r":255,"g":0,"b":0,"a":255}
- `green` — type=color, default={"r":0,"g":255,"b":0,"a":255}
- `blue` — type=color, default={"r":0,"g":0,"b":255,"a":255}
- `passes` — type=int, default=1
- `passDist` — type=int, default=10
- `autoPad` — type=bool, default=true
- `rotation` — type=double, default=0
- `strength` — type=double, default=100
- `redOffset` — type=double2, default={"x":20,"y":0}
- `greenOffset` — type=double2, default={"x":20,"y":20}
- `blueOffset` — type=double2, default={"x":-20,"y":0}
- `baseLayer` — type=bool, default=true
- `viewPort` — type=double, default=0
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=12

## rigControl

Node identifier: rigControl.
Supertype: atomic.
Concrete attributes (6):
- `rigControlHelp` — type=bool, default=true
- `amount` — type=double2
- `active` — type=bool, default=false
- `colorId` — type=int, default=5
- `graph` — type=list
- `out` — type=any

## ringRectPatternGenerator

Node identifier: ringRectPatternGenerator.
Supertype: rectPatternItem.
Concrete attributes (6):
- `radius` — type=double, default=500
- `innerRadius` — type=double, default=400
- `startAngle` — type=double, default=0
- `endAngle` — type=double, default=360
- `fixedGapAngle` — type=double, default=1
- `gapType` — type=enum, default=1

## ringShape

Node identifier: ringShape.
Supertype: primitive.
Concrete attributes (3):
- `divisions` — type=int, default=0
- `radius` — type=double, default=100
- `width` — type=double, default=40

## roseDistribution

Node identifier: roseDistribution.
Supertype: distribution.
Concrete attributes (4):
- `count` — type=int, default=500
- `radius` — type=double, default=30
- `seed` — type=double2, default={"x":4,"y":5}
- `length` — type=double, default=5

## round

Node identifier: round.
Supertype: behaviour.
Concrete attributes (5):
- `out`
- `value` — type=double, default=0
- `rounding` — type=int, default=2
- `deformerMode` — type=enum, default=0
- `roundingMode` — type=enum, default=0

## rubberHoseLimb

Node identifier: rubberHoseLimb.
Supertype: behaviourBase.
Concrete attributes (13):
- `topJoint` — type=nodeId
- `bottomJoint` — type=nodeId
- `out`
- `strength` — type=double, default=100
- `graph` — type=list
- `pathSpace` — type=bool, default=false
- `flip` — type=bool, default=false
- `stretch` — type=bool, default=true
- `length` — type=double, default=150
- `jointPosition` — type=double, default=50
- `curvature` — type=double2, default={"x":50,"y":50}
- `rotation` — type=double2
- `offset` — type=double2

## schedulingGroup

Node identifier: schedulingGroup.
Supertype: element.
Concrete attributes (12):
- `childOffset` — type=double, default=0
- `needUpdate` — type=bool, default=false
- `needReset` — type=bool, default=false
- `orderingPolicy` — type=enum, default=0
- `flipOrder` — type=bool, default=false
- `shapesOnly` — type=bool, default=true
- `excludeList` — type=list
- `startFrame` — type=int, default=0
- `endFrame` — type=int, default=249
- `scheduleFromEnd` — type=bool, default=false
- `sequencing` — type=bool, default=false
- `overlap` — type=double, default=0

## scrapeFilter

Node identifier: scrapeFilter.
Supertype: filter.
Concrete attributes (9):
- `matteApplyMode` — default=1
- `offset` — type=double2
- `rotation` — type=double
- `amount` — type=double, default=50
- `padding` — type=double, default=0
- `invert` — type=bool
- `unlockOffset` — type=bool
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=3

## sdfShadow

Node identifier: sdfShadow.
Supertype: filter.
Concrete attributes (6):
- `shadowRadius` — type=double, default=20
- `shadowSoftness` — type=double, default=2
- `shadowIntensity` — type=double, default=0.5
- `shadowOffset` — type=double2, default={"x":0,"y":0}
- `innerShadow` — type=bool, default=false
- `debugMode` — type=int, default=0

## secondsToFrames

Node identifier: secondsToFrames.
Supertype: atomic.
Concrete attributes (3):
- `seconds` — type=double
- `out` — type=int
- `fps` — type=double

## segmentPath

Node identifier: segmentPath.
Supertype: shape.
Concrete attributes (9):
- `inputShapes` — type=list
- `mode` — type=enum, default=0
- `count` — type=int, default=10
- `relativeCounts` — type=bool, default=false
- `reverse` — type=bool, default=false
- `travel` — type=double, default=0
- `extensionMode` — type=enum, default=2
- `extend` — type=double, default=0
- `stroke`

## sequence

Node identifier: sequence.
Supertype: atomic.
Concrete attributes (10):
- `out` — type=any
- `sequence` — type=int2, default={"x":0,"y":4}
- `randomize` — type=bool, default=true
- `seed` — type=int
- `autoIndex` — type=bool, default=true
- `arrayIndex` — type=int
- `skipIndices` — type=string, default=""
- `reverse` — type=bool, default=false
- `offset` — type=int, default=0
- `travel` — type=int, default=0

## shaderArray

Node identifier: shaderArray.
Supertype: indexableArray.
Concrete attributes (2):
- `array` — type=list, default={"list":[{}]}
- `out`

## shapeArray

Node identifier: shapeArray.
Supertype: indexableArray.
Concrete attributes (2):
- `array` — type=list, default={"list":[{}]}
- `out`

## shapeEdgeDistribution

Node identifier: shapeEdgeDistribution.
Supertype: distribution.
Concrete attributes (5):
- `inputShape` — type=nodeId
- `calculateRotations` — type=bool, default=true
- `count` — type=int, default=3
- `fill` — type=bool, default=true
- `bias` — type=double, default=0.5

## shapeGradientShader

Node identifier: shapeGradientShader.
Supertype: gradientOperator.
Concrete attributes (10):
- `gradient` — type=list
- `radius` — type=double, default=100
- `sides` — type=int, default=8
- `rotation` — type=double, default=0
- `offset` — type=double2
- `radiusMode` — type=enum, default=1
- `radiusRatio` — type=double, default=1
- `wrapUVs` — type=bool, default=false
- `scale` — type=double2, default={"x":100,"y":100}
- `legacyRotation` — type=bool, default=false

## shapeOffset

Node identifier: shapeOffset.
Supertype: shape.
Concrete attributes (4):
- `inputShape` — type=polyMesh
- `offsetPosition` — type=double2
- `offsetRotation` — type=double
- `offsetScale` — type=double2, default={"x":1,"y":1}

## shapePointDistribution

Node identifier: shapePointDistribution.
Supertype: distribution.
Concrete attributes (4):
- `inputShape` — type=nodeId
- `calculateRotations` — type=bool, default=true
- `count` — type=int, default=3
- `fill` — type=bool, default=true

## shapeToShader

Node identifier: shapeToShader.
Supertype: shader.
Concrete attributes (4):
- `inputShape` — type=nodeId
- `alpha` — type=double, default=100
- `blendMode` — type=enum, default=3
- `renderQuality` — type=enum, default=0

## sharpenFilter

Node identifier: sharpenFilter.
Supertype: filter.
Concrete attributes (4):
- `matteApplyMode` — default=1
- `intensity` — type=double, default=50
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=1

## shiftChannels

Node identifier: shiftChannels.
Supertype: filter.
Concrete attributes (5):
- `aSource` — type=enum, default=1
- `rSource` — type=enum, default=2
- `gSource` — type=enum, default=3
- `bSource` — type=enum, default=4
- `matteApplyMode` — default=1

## shortestPath

Node identifier: shortestPath.
Supertype: shape.
Concrete attributes (13):
- `distribution` — type=nodeId
- `inputShape` — type=nodeId
- `stroke`
- `shapeColor` — type=color
- `count` — type=int, default=1
- `countHelp` — type=bool, default=true
- `startParam` — type=double, default=0
- `endParam` — type=double, default=0.5
- `useSearchRadius` — type=bool
- `searchRadius` — type=double, default=50
- `levelMode` — type=enum
- `level` — type=int, default=1
- `useLevels` — type=bool, default=false

## shuffleArray

Node identifier: shuffleArray.
Supertype: arrayOperator.
Concrete attributes (1):
- `seed` — type=int, default=true

## shuffleDistribution

Node identifier: shuffleDistribution.
Supertype: distribution.
Concrete attributes (4):
- `input` — type=nodeId
- `reverse` — type=bool, default=false
- `shuffle` — type=bool, default=true
- `seed` — type=int, default=false

## shuffleString

Node identifier: shuffleString.
Supertype: stringOperator.
Concrete attributes (15):
- `percentage` — type=double, default=100
- `randomSeed` — type=int, default=1
- `shuffleFromEnd` — type=bool, default=true
- `shuffleFromInput` — type=bool, default=true
- `timeOffset` — type=double, default=0
- `keepPunctuation` — type=bool, default=true
- `shuffleText` — type=string, default="Shuffle Text"
- `unicodeOffset` — type=int, default=1
- `shuffleType` — type=enum, default=1
- `directionMode` — type=enum, default=0
- `indexMode` — type=enum, default=3
- `mode` — type=enum, default=2
- `regex` — type=string, default="[0-9]+"
- `captureGroupIndices` — type=string, default=""
- `indices` — type=string, default="first,last"

## simpleLine

Node identifier: simpleLine.
Supertype: lineGenerator.
Concrete attributes (2):
- `divisions` — default=10
- `length` — type=double, default=200

## simpleMeshSolver

Node identifier: simpleMeshSolver.
Supertype: behaviourBase.
Concrete attributes (5):
- `out`
- `saveLimit` — type=int, default=25
- `time` — type=int
- `startFrame` — type=int
- `endFrame` — type=int

## simpleValue2Solver

Node identifier: simpleValue2Solver.
Supertype: behaviourBase.
Concrete attributes (14):
- `out` — type=double2
- `mode` — type=enum
- `value` — type=double2
- `offset` — type=double2
- `fadeMode` — type=enum
- `fadeValue` — type=double2
- `saveLimit` — type=int, default=25
- `time` — type=int
- `startFrame` — type=int
- `endFrame` — type=int
- `useCache` — type=bool, default=false
- `cacheFilePath` — type=string
- `cache` — type=double2Vector, read-only
- `cacheOffset` — type=int

## simpleValueSolver

Node identifier: simpleValueSolver.
Supertype: behaviourBase.
Concrete attributes (14):
- `out` — type=double
- `mode` — type=enum
- `value` — type=double
- `offset` — type=double
- `fadeMode` — type=enum
- `fadeValue` — type=double, default=0.95
- `saveLimit` — type=int, default=25
- `time` — type=int
- `startFrame` — type=int
- `endFrame` — type=int
- `useCache` — type=bool, default=false
- `cacheFilePath` — type=string
- `cache` — type=doubleVector, read-only
- `cacheOffset` — type=int

## simplexNoise

Node identifier: simplexNoise.
Supertype: noiseEngine.
Concrete attributes (5):
- `octaves` — type=int, default=1
- `lacunarity` — type=double, default=2
- `gain` — type=double, default=0.5
- `curl` — type=bool, default=false
- `curlAmplitude` — type=double, default=50

## skeleton

Node identifier: skeleton.
Supertype: drawable.
Tags: beta.
Concrete attributes (6):
- `bones` — type=list
- `controllers` — type=list
- `solverUpdate` — type=bool
- `bind` — type=bool, default=false
- `drawColor` — type=color, default={"r":58,"g":174,"b":240,"a":255}
- `highlightedBone` — type=string, default=""

## skew

Node identifier: skew.
Supertype: behaviourBase.
Concrete attributes (5):
- `skew` — type=double2
- `pivotX` — type=double, default=50
- `pivotY` — type=double, default=50
- `strength` — type=double, default=100
- `out`

## skinning

Node identifier: skinning.
Supertype: behaviourBase.
Tags: beta.
Concrete attributes (3):
- `skeleton` — type=nodeId
- `maxWeightsPerVertex` — type=int, default=3
- `graph` — type=list

## skslFilter

Node identifier: skslFilter.
Supertype: filter.
Concrete attributes (5):
- `code` — type=string, default="uniform shader layer;\n\n// A simple pseudo-random generator based on the pixel coordinate.\nhalf random(half2 co) {\n    return fract(sin(dot(co, half2(12.9898, 78.233))) * 43758.5453);\n}\n\nhalf4 main(float2 p) {\n    // Apply a scanline effect by modulating brightness along the vertical axis.\n    half scan = 0.85 + 0.15 * sin(p.y * 0.05 + n0);\n\n    // Generate a noise value per pixel. Adjusted to range [-1, 1].\n    half noise = random(p + n0);\n    noise = noise * 2.0 - 1.0;\n\n    // Base sample of the original image.\n    half4 baseColor = layer.eval(p);\n    \n    // Simulate a chromatic aberration by slightly offsetting red and blue channels.\n    half4 redSample  = layer.eval(p + half2(2.0 * noise, 0.0));\n    half4 blueSample = layer.eval(p - half2(2.0 * noise, 0.0));\n\n    // Combine channels: red from the offset red sample, green from base, and blue from the offset blue sample.\n    half3 color = half3(redSample.r, baseColor.g, blueSample.b);\n    \n    // Apply the scanline effect and add a subtle noise overlay.\n    color = color * scan + noise * 0.05;\n    color = clamp(color, 0.0, 1.0);\n\n    return half4(color, baseColor.a);\n}"
- `inputs` — type=dynamic, default={"list":[{"value":1,"varType":"double"}]}
- `padding` — type=int2
- `outCode` — type=string
- `blendMode` — type=enum, default=1

## skslShader

Node identifier: skslShader.
Supertype: shader.
Concrete attributes (4):
- `code` — type=string, default="float3 color1 = float3(1.0, 0.0, 0.0); // Red\nfloat3 color2 = float3(0.0, 0.0, 1.0); // Blue\n\nhalf4 main(float2 coord) {\n    float zoom = 0.005;\n    float2 pos = coord * zoom;\n    float timeFactor = (n0 + 120) / 1000.0;\n\n    for (int index = 1; index < 10; index++) {\n        float idx = float(index);\n        float fraction = 0.5 / idx;\n        float angleX = idx * 3.0 * pos.y;\n        float angleY = idx * 3.0 * pos.x;\n        pos.x += fraction * cos(angleX) + timeFactor;\n        pos.y += fraction * sin(angleY);\n    }\n\n    float sumComponents = pos.x + pos.y;\n\n    // Calculate blending factors for each color channel\n    float tR = cos(sumComponents) * 0.5 + 0.5;\n    float tG = (sin(sumComponents) + sin(sumComponents)) * 0.25 + 0.5;\n    float tB = sin(sumComponents) * 0.5 + 0.5;\n\n    // Blend the two colors based on the calculated factors\n    float3 finalColor = float3(\n        mix(color1.r, color2.r, tR),\n        mix(color1.g, color2.g, tG),\n        mix(color1.b, color2.b, tB)\n    );\n\n    return half4(finalColor, 1.0);\n}"
- `blendMode` — type=enum, default=3
- `inputs` — type=dynamic, default={"list":[{"value":0,"varType":"double"}]}
- `outCode` — type=string

## slaShader

Node identifier: slaShader.
Supertype: shader.
Concrete attributes (14):
- `colorA` — type=color, default={"r":0,"g":0,"b":0,"a":255}
- `colorB` — type=color, default={"r":255,"g":255,"b":255,"a":255}
- `noiseType` — type=enum, default=0
- `octaves` — type=int, default=8
- `invert` — type=bool
- `offset` — type=double2
- `scale` — type=double2, default={"x":1,"y":1}
- `lowerBound` — type=double, default=0
- `upperBound` — type=double, default=0
- `displacement` — type=double, default=0.55
- `time` — type=double, default=0
- `timeScale` — type=double, default=1
- `gamma` — type=double, default=1
- `blendMode` — type=enum, default=3

## slitScanFilter

Node identifier: slitScanFilter.
Supertype: filter.
Concrete attributes (12):
- `matteApplyMode` — default=1
- `offset` — type=double, default=500
- `mirrorScan` — type=bool, default="true"
- `time` — type=double
- `rotation` — type=double
- `speed` — type=double, default=100
- `perspective` — type=double, default=50
- `glow` — type=double, default=40
- `glowColor` — type=color, default={"r":255,"g":255,"b":255,"a":255}
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=3
- `glowBlendMode` — type=enum, default=3

## sortArray

Node identifier: sortArray.
Supertype: arrayOperator.
Concrete attributes (3):
- `ascending` — type=bool, default=true
- `mode` — type=enum, default=0
- `secondArray` — type=nodeId

## sortDistribution

Node identifier: sortDistribution.
Supertype: distribution.
Concrete attributes (5):
- `input` — type=nodeId
- `mode` — type=enum, default=0
- `reverse` — type=bool, default=false
- `target` — type=nodeId
- `offset` — type=int, default=0

## sound

Node identifier: sound.
Supertype: behaviour.
Concrete attributes (26):
- `colorId` — default=6
- `on` — type=bool, default=1
- `file` — type=assetId
- `time` — type=double, default=0
- `bands` — type=int, default=10
- `beatCounter` — type=int, read-only
- `value` — type=double
- `fps` — type=double
- `subSteps` — type=int, default=0
- `smoothingFrames` — type=int, default=1
- `eqGraph` — type=graph, default={}
- `clipping` — type=double, default=0
- `useIndex` — type=bool, default=true
- `frameOffset` — type=double
- `offset` — type=double, default=0
- `maxDb` — type=double, default=0
- `length` — type=double, default=0
- `playbackVolume` — type=double, default=0
- `frequencyRange` — type=double2, default={"x":27.5,"y":4186}
- `playAudio` — type=bool, default=true
- `playbackPan` — type=double, default=0
- `frequencyScale` — type=enum, default=1
- `aWeighting` — type=bool, default=true
- `weightingGraph` — type=list
- `out`
- `outActiveBands` — type=int

## spacerItem

Node identifier: spacerItem.
Supertype: shape.
Concrete attributes (2):
- `useFixedSize` — type=bool, default=false
- `fixedSize` — type=double2, default={"x":25,"y":25}

## speedModifier

Node identifier: speedModifier.
Supertype: particlePhysicsModifier.
Concrete attributes (7):
- `dragForce` — type=double, default=5
- `physicsMode` — type=enum, default=0
- `topSpeed` — type=double, default=10
- `limitType` — type=enum, default=0
- `customColor` — type=bool
- `drawColor` — type=color, default={"r":58,"g":174,"b":240,"a":255}
- `out` — type=particlePoolData

## spiralLine

Node identifier: spiralLine.
Supertype: lineGenerator.
Concrete attributes (5):
- `radius` — type=double, default=200
- `innerRadius` — type=double, default=0
- `sides` — type=int, default=100
- `endAngle` — type=double, default=1800
- `startAngle` — type=double, default=0

## spreadsheet

Node identifier: spreadsheet.
Supertype: atomic.
Concrete attributes (14):
- `column` — type=double
- `excelSheet` — type=int
- `file` — type=assetId
- `factorize` — type=bool, default=false
- `remapping` — type=nodeId
- `useFixedRow` — type=bool, default=false
- `rowIndex` — type=int, default=0
- `rowOffset` — type=int, default=0
- `useEveryNth` — type=int, default=1
- `interpolate` — type=bool, default=false
- `outputMode` — type=enum, default=0
- `out` — type=any
- `rowCount` — type=int, read-only
- `columnCount` — type=int, read-only

## spreadsheetLookup

Node identifier: spreadsheetLookup.
Supertype: atomic.
Concrete attributes (6):
- `lookupColumn` — type=int
- `excelSheet` — type=int
- `key` — type=string
- `valueColumn` — type=int
- `file` — type=assetId
- `out` — type=any

## spring

Node identifier: spring.
Supertype: behaviour.
Tags: beta.
Concrete attributes (5):
- `time` — type=double, default=0
- `damping` — type=double, default=0.7
- `mass` — type=double, default=1
- `speedLimit` — type=double, default=100
- `out`

## squashAndStretch

Node identifier: squashAndStretch.
Supertype: behaviourBase.
Concrete attributes (13):
- `amount` — type=double, default=0
- `pin` — type=enum, default=2
- `bulge` — type=double, default=0
- `graph` — type=list
- `out`
- `strength` — type=double, default=100
- `automaticBulge` — type=bool, default=true
- `subdivideGeometry` — type=bool, default=false
- `areaPreservation` — type=bool, default=true
- `levelMode` — type=enum
- `level` — type=int, default=1
- `useLevels` — type=bool, default=false
- `highQuality` — type=bool, default=false

## squetch

Node identifier: squetch.
Supertype: behaviour.
Concrete attributes (5):
- `out`
- `amount` — type=double, default=0
- `pin` — type=enum, default=0
- `bulge` — type=double, default=0
- `graph` — type=list

## squircleShape

Node identifier: squircleShape.
Supertype: primitive.
Concrete attributes (5):
- `dimensions` — type=double2, default={"x":512,"y":512}
- `cornerRadius` — type=double, default=200
- `cornerSmoothing` — type=double, default=0.6
- `divisions` — type=int, default=8
- `bezier` — type=bool, default=true

## stagger

Node identifier: stagger.
Supertype: behaviour.
Concrete attributes (5):
- `minimum` — type=double, default=0
- `maximum` — type=double, default=5
- `offset` — type=double, default=0
- `graph` — type=list
- `out`

## starShape

Node identifier: starShape.
Supertype: primitive.
Concrete attributes (6):
- `divisions` — type=int, default=0
- `radius` — type=double, default=100
- `useInnerRadius` — type=bool, default=false
- `innerRadius` — type=double, default=20
- `sides` — type=int, default=5
- `useIndividualRadii` — type=bool, default=false

## stickyCollisionEvent

Node identifier: stickyCollisionEvent.
Supertype: collisionEvent.
Concrete attributes (6):
- `time` — type=int
- `breakable` — type=bool, default=false
- `breakingForce` — type=double, default=0.5
- `angularBreakingForce` — type=double, default=0.1
- `stiffness` — type=double, default=0
- `damping` — type=double, default=0

## stitches

Node identifier: stitches.
Supertype: behaviourBase.
Concrete attributes (6):
- `mode` — type=enum, default=1
- `distance` — type=double, default=20
- `spread` — type=double, default=0
- `disconnectionMultiplier` — type=double, default=5
- `rotation` — type=double, default=0
- `keepOrignalPath` — type=bool, default=false

## string

Node identifier: string.
Supertype: atomic.
Concrete attributes (3):
- `string` — type=string, default="Cavalry"
- `manipulators` — type=list
- `out` — type=string, read-only

## stringArray

Node identifier: stringArray.
Supertype: indexableArray.
Concrete attributes (6):
- `mode` — type=enum
- `reverse`
- `autoIndex`
- `arrayIndex`
- `array` — type=list, default={"list":[{}]}
- `out` — type=string

## stringFromAsset

Node identifier: stringFromAsset.
Supertype: atomic.
Concrete attributes (2):
- `asset` — type=assetId
- `out` — type=string

## stringGenerator

Node identifier: stringGenerator.
Supertype: atomic.
Concrete attributes (7):
- `out` — type=string, read-only
- `generator` — type=nodeId
- `manipulators` — type=list
- `allCaps` — type=bool, default=false
- `prefix` — type=string
- `suffix` — type=string
- `useIndex` — type=bool, default=true

## stringLength

Node identifier: stringLength.
Supertype: atomic.
Concrete attributes (3):
- `string` — type=string
- `mode` — type=enum
- `out` — type=int

## stringManipulator

Node identifier: stringManipulator.
Supertype: atomic.
Concrete attributes (2):
- `out` — type=string, read-only
- `generator` — type=nodeId

## stripesFilter

Node identifier: stripesFilter.
Supertype: filter.
Concrete attributes (8):
- `samplerOffset` — type=double2, default={"x":0,"y":0}
- `padding` — type=double
- `unlockOffset` — type=bool
- `samplerRotation` — type=double
- `rotation` — type=double
- `clippingRange` — type=double2, default={"x":50,"y":100}
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=3

## strokeDuplicator

Node identifier: strokeDuplicator.
Supertype: material.
Concrete attributes (3):
- `strokeCount` — type=int, default=3
- `stroke` — type=nodeId
- `out` — type=stroke

## strokeMaterial

Node identifier: strokeMaterial.
Supertype: material.
Tags: material.
Concrete attributes (28):
- `colorMode` — type=enum, default=0
- `strokeColor` — type=color, default={"r":25,"g":25,"b":25}
- `gradient` — type=list
- `gradientMode` — type=enum
- `width` — type=double, default=4
- `capStyle` — type=enum, default=0
- `joinStyle` — type=enum, default=0
- `miter` — type=double, default=10
- `dashPatternMode` — type=enum, default=0
- `dashPattern` — type=string
- `dashOffset` — type=double, default=0
- `trim` — type=bool, default=false
- `trimStart` — type=double, default=0
- `trimEnd` — type=double, default=100
- `trimTravel` — type=double, default=0
- `reversePath` — type=bool, default=false
- `align` — type=enum, default=0
- `taperedWidth` — type=bool, default=false
- `doubleTaperHelp` — type=bool, default=true
- `doubleTaper` — type=bool, default=false
- `taperFrom` — type=double, default=50
- `middleLength` — type=double, default=0
- `startWidth` — type=double, default=0
- `endWidth` — type=double, default=100
- `capCentres` — type=double, default=50
- `colorShaders` — type=list
- `alpha` — type=double, default=100
- `out` — type=stroke

## subBoundingBox

Node identifier: subBoundingBox.
Supertype: shape.
Tags: beta.
Concrete attributes (10):
- `inputShape` — type=nodeId
- `level` — type=int, default=1
- `expand` — type=double2
- `preserveGapMode` — type=bool
- `minimumSize` — type=double2
- `specificIndices` — type=string, default=""
- `material`
- `fixedSize` — type=double2, default={"x":600,"y":200}
- `autoWidth` — type=bool, default=true
- `autoHeight` — type=bool, default=true

## subdivide

Node identifier: subdivide.
Supertype: behaviourBase.
Concrete attributes (4):
- `subdivisions` — type=int, default=3
- `curveToEndPoints` — type=bool, default=false
- `smoothAngle` — type=double, default=0
- `threshold` — type=double, default=2

## subMesh

Node identifier: subMesh.
Supertype: behaviour.
Concrete attributes (24):
- `shapePosition` — type=double2
- `shapeRotation` — type=double
- `shapeScale` — type=double2, default={"x":1,"y":1}
- `shapeVisibility` — type=bool, default=true
- `shapeTimeOffset` — type=double
- `opacityMode` — type=enum, default=0
- `shapeOpacity` — type=double, default=100
- `transformAroundCenter` — type=bool, default=false
- `pivotPosition` — type=double2
- `out`
- `mode` — type=enum
- `levelMode` — type=enum
- `levels` — type=int2, default={"x":3,"y":3}
- `flattenMeshAtLevel` — type=bool, default=false
- `useIndex` — type=bool, default=true
- `fillReplacementMode` — type=enum
- `strokeReplacementMode` — type=enum
- `material` — type=nodeId
- `stroke` — type=nodeId
- `filters` — type=list
- `fillBehaviours` — type=list
- `strokeBehaviours` — type=list
- `deformers` — type=list
- `indexMode` — type=enum, default=0

## subString

Node identifier: subString.
Supertype: stringOperator.
Concrete attributes (3):
- `start` — type=int, default=0
- `end` — type=int, default=3
- `excludeEnd` — type=bool, default=false

## superEllipseShape

Node identifier: superEllipseShape.
Supertype: primitive.
Concrete attributes (4):
- `divisions` — type=int, default=0
- `radius` — type=double, default=100
- `push` — type=double, default=0.5
- `bezier` — type=bool, default=true

## superShape

Node identifier: superShape.
Supertype: primitive.
Concrete attributes (8):
- `divisions` — type=int, default=0
- `radius` — type=double, default=100
- `complexity` — type=int, default=12
- `n1` — type=double, default=3
- `n2` — type=double, default=4
- `n3` — type=double, default=10
- `a` — type=double, default=4
- `b` — type=double, default=2

## svgShape

Node identifier: svgShape.
Supertype: shape.
Concrete attributes (3):
- `input` — type=assetId
- `useMaterials` — type=bool, default=true
- `useStrokes` — type=bool, default=true

## sweepGradientShader

Node identifier: sweepGradientShader.
Supertype: gradientOperator.
Concrete attributes (8):
- `gradient` — type=list
- `startAngle` — type=double, default=0
- `endAngle` — type=double, default=360
- `spiralRadius` — type=double, default=-1
- `offset` — type=double2
- `rotation` — type=double
- `wrapUVs` — type=bool, default=false
- `legacyRotation` — type=bool, default=false

## testFft

Node identifier: testFft.
Supertype: shape.
Concrete attributes (1):
- `inputPath` — type=nodeId

## textArray

Node identifier: textArray.
Supertype: indexableArray.
Concrete attributes (2):
- `array` — type=list, default={"list":[{}]}
- `out`

## textBlockUnicode

Node identifier: textBlockUnicode.
Supertype: textEngine.
Concrete attributes (10):
- `paragraphs` — type=int, default=1, keyable, connectable
- `linesPerParagraph` — type=int, default=1, keyable, connectable
- `wordsPerLine` — type=int, default=1, keyable, connectable
- `charsPerWord` — type=int, default=6, keyable, connectable
- `mode` — type=enum, default=0
- `codePoint` — type=int, default=67, keyable, connectable
- `character` — type=string, default="X", connectable
- `wordDelimiter` — type=string, default=" "
- `lineDelimiter` — type=string, default="\n"
- `paragraphDelimiter` — type=string, default="\n\n"

## textDate

Node identifier: textDate.
Supertype: textEngine.
Concrete attributes (6):
- `startDate` — type=int3, default={"x":2,"y":2,"z":2020}
- `endDate` — type=int3, default={"x":11,"y":8,"z":2020}
- `randomSeed` — type=int, default=0
- `formatting` — type=enum, default=0
- `delimiter` — type=string, default="/"
- `padding` — type=bool, default=true

## textFormatted

Node identifier: textFormatted.
Supertype: textEngine.
Concrete attributes (2):
- `inputString` — type=string, default="#{0}"
- `array` — type=list, default={"list":[{"value":"cavalryapp","varType":"string"}]}

## textHash

Node identifier: textHash.
Supertype: textEngine.
Concrete attributes (3):
- `numberOfLines` — type=int, default=2
- `lineOffset` — type=int, default=0
- `randomSeed` — type=int, default=0

## textHex

Node identifier: textHex.
Supertype: textEngine.
Concrete attributes (4):
- `numberOfLines` — type=int, default=2
- `lineOffset` — type=int, default=0
- `length` — type=int, default=8
- `randomSeed` — type=int, default=0

## textNumber

Node identifier: textNumber.
Supertype: textEngine.
Concrete attributes (10):
- `minimum` — type=double, default=0
- `maximum` — type=double, default=100
- `randomSeed` — type=int, default=0
- `precision` — type=int, default=3
- `length` — type=int, default=3
- `wholeNumbers` — type=bool, default=false
- `clampAtMinimum` — type=bool, default=false
- `clampAtMaximum` — type=bool, default=false
- `delimiter` — type=string, default=""
- `multiplier` — type=double, default=1

## textShape

Node identifier: textShape.
Supertype: shape.
Concrete attributes (47):
- `colorId` — default=8
- `material`
- `text` — type=richText, default="Cavalry"
- `font` — type=font, default={"font":"Lato","style":"Regular"}
- `fontAxes` — type=list
- `typeface` — type=typeface
- `horizontalAlignment` — type=enum, default=0
- `verticalAlignment` — type=enum, default=0
- `letterSpacing` — type=double, default=0
- `wordSpacing` — type=double, default=0
- `lineSpacing` — type=double, default=0
- `paragraphSpacing` — type=double, default=0
- `monospaceMultiplier` — type=double, default=1
- `forceMonospace` — type=bool, default=false
- `lineStyle` — type=enum, default=0
- `style` — type=bool
- `textBoxSize` — type=double2, default={"x":600,"y":300}
- `autoWidth` — type=bool, default=false
- `autoHeight` — type=bool, default=false
- `manipulators` — type=list
- `styleBehaviours` — type=list
- `materialBehaviours` — type=list
- `selection` — type=int2
- `fontSize` — type=double, default=72
- `autoScaleFontSize` — type=bool, default=false
- `allowWordBreaks` — type=bool, default=true
- `avoidOrphans` — type=bool, default=false
- `array` — type=list
- `backgroundShape` — type=polyMesh, read-only
- `backgroundPadding` — type=double2
- `ascenderAdjustment` — type=double
- `descenderAdjustment` — type=double
- `backgroundMode` — type=enum, default=0
- `specificIndices` — type=string, default=""
- `textPath` — type=nodeId
- `pathPush` — type=double
- `pathTravel` — type=double
- `pathLoop` — type=bool
- `outData` — type=textShapeData
- `fontScale` — type=double, read-only
- `autoName` — type=bool, default=true
- `radiusMode` — type=enum, default=0
- `chamfer` — type=bool
- `cornerRadius` — type=double, default=0
- `radiusTop` — type=double2, default={"x":5,"y":5}
- `radiusBottom` — type=double2, default={"x":5,"y":5}
- `decoratorShape` — type=polyMesh, read-only

## textTimecode

Node identifier: textTimecode.
Supertype: textEngine.
Concrete attributes (4):
- `frame` — type=int
- `offset` — type=int, default=0
- `fps` — type=double
- `delimiter` — type=string, default=":"

## textValue

Node identifier: textValue.
Supertype: textEngine.
Concrete attributes (6):
- `number` — type=double, default=0
- `precision` — type=int, default=3
- `length` — type=int, default=5
- `delimiter` — type=string, default=""
- `decimalSeparator` — type=string, default=""
- `multiplier` — type=double, default=1

## thresholdFilter

Node identifier: thresholdFilter.
Supertype: filter.
Concrete attributes (3):
- `matteApplyMode` — default=1
- `threshold` — type=double, default=0.5
- `blendMode` — type=enum, default=1

## timelineCounter

Node identifier: timelineCounter.
Supertype: atomic.
Concrete attributes (15):
- `out` — type=double
- `time` — type=double
- `timeMarkers` — type=nodeId
- `bpm` — type=double
- `beatOffset` — type=double
- `fps` — type=double
- `countTarget` — type=enum, default=0
- `countMode` — type=enum, default=0
- `convolutionSize` — type=int, default=0
- `convolutionOffset` — type=int, default=0
- `graph` — type=list
- `filterMarkerColor` — type=bool, default=false
- `markerColor` — type=string, default="Blue"
- `markerColorId` — type=int, default=0
- `legacyGraph` — type=bool, default=false

## timeMarker

Node identifier: timeMarker.
Supertype: none.
Concrete attributes (13):
- `label` — type=string, default=""
- `drawColor` — type=string, default="Blue"
- `drawColorId` — type=int, default=5
- `out` — type=double, default=0
- `locked` — type=bool, default=false
- `useRelPlacement` — type=bool, default=false
- `absTime` — type=double, default=0
- `relTime` — type=double, default=0
- `frameRange` — type=int2
- `showRegion` — type=bool, default=false
- `colorRegion` — type=int2, default={"x":0,"y":0}
- `timelineDrawMode` — type=enum
- `preCompDrawMode` — type=enum

## timeMarkerFolder

Node identifier: timeMarkerFolder.
Supertype: hiddenFolder.
Concrete attributes (1):
- `needUpdate` — type=bool, default=false

## timeStepFilter

Node identifier: timeStepFilter.
Supertype: filter.
Concrete attributes (2):
- `out`
- `time` — type=double

## toonOutlines

Node identifier: toonOutlines.
Supertype: behaviourBase.
Concrete attributes (8):
- `strokeCount` — type=int, default=10
- `minimumDistance` — type=double, default=5
- `maximumDistance` — type=double, default=50
- `overlap` — type=double, default=50
- `seed` — type=int, default=0
- `travel` — type=double, default=0
- `stroke` — type=nodeId
- `deformers` — type=list

## trails

Node identifier: trails.
Supertype: shape.
Tags: beta.
Concrete attributes (10):
- `stroke`
- `shapes` — type=list
- `useIndex` — type=bool, default=true
- `useParticleColor` — type=bool, default=false
- `time` — type=double, default=0
- `limitLength` — type=bool, default=true
- `length` — type=int, default=25
- `startFrame` — type=int, default=0
- `pathType` — type=enum, default=1
- `timeOffset` — type=double, default=0

## transformConstraint

Node identifier: transformConstraint.
Supertype: atomic.
Concrete attributes (10):
- `target` — type=nodeId
- `offset` — type=double2
- `restPosition` — type=double2
- `positionStrength` — type=double2, default={"x":100,"y":100}
- `outRotation` — type=double, read-only
- `rotationStrength` — type=double, default=100
- `restRotation` — type=double
- `restOffset` — type=double2
- `outOffset` — type=double2
- `out` — type=double2

## transformDistribution

Node identifier: transformDistribution.
Supertype: connectDistribution.
Concrete attributes (1):
- `inputShape` — type=nodeId

## transitionString

Node identifier: transitionString.
Supertype: stringOperator.
Concrete attributes (5):
- `destinationText` — type=string, default="Animate"
- `percentage` — type=double, default=0
- `length` — type=int, default=5
- `mode` — type=enum, default=0
- `transitionFromEnd` — type=bool, default=false

## travel

Node identifier: travel.
Supertype: behaviourBase.
Concrete attributes (1):
- `travel` — type=double, default=0

## triangulate

Node identifier: triangulate.
Supertype: behaviourBase.
Concrete attributes (0):

## triToneFilter

Node identifier: triToneFilter.
Supertype: filter.
Concrete attributes (7):
- `matteApplyMode` — default=1
- `highlightColor` — type=color, default={"r":225,"g":255,"b":225,"a":255}
- `midTonesColor` — type=color, default={"r":100,"g":125,"b":155,"a":255}
- `shadowColor` — type=color, default={"r":50,"g":20,"b":20,"a":255}
- `mid` — type=double, default=0.465
- `blendMode` — type=enum, default=1
- `opacity` — type=double, default=100

## turbulenceModifier

Node identifier: turbulenceModifier.
Supertype: particlePhysicsModifier.
Concrete attributes (6):
- `forceMagnitude` — type=double, default=100
- `physicsMode` — type=enum, default=0
- `customColor` — type=bool
- `generator` — type=nodeId
- `drawColor` — type=color, default={"r":242,"g":35,"b":229,"a":255}
- `out` — type=particlePoolData

## typeface

Node identifier: typeface.
Supertype: atomic.
Concrete attributes (3):
- `font` — type=font
- `fontAxes` — type=list
- `out` — type=typeface

## typefaceArray

Node identifier: typefaceArray.
Supertype: indexableArray.
Concrete attributes (2):
- `array` — type=list, default={"list":[{}]}
- `out`

## typeShape

Node identifier: typeShape.
Supertype: shape.
Concrete attributes (14):
- `material`
- `text` — type=string, default="Cavalry"
- `font` — type=font
- `fontSize` — type=int, default=72
- `fontAxes` — type=list
- `typeface` — type=typeface
- `alignment` — type=enum, default=0
- `verticalAlignment` — type=enum, default=0
- `spacing` — type=double, default=0
- `wordSpacing` — type=double, default=0
- `lineSpacing` — type=double, default=0
- `monospaceMultiplier` — type=double, default=1
- `forceMonospace` — type=bool, default=false
- `manipulators` — type=list

## unicodeManipulator

Node identifier: unicodeManipulator.
Supertype: stringOperator.
Concrete attributes (11):
- `offset` — type=int, default=1
- `clampToRange` — type=bool, default=false
- `codePointRange` — type=int2, default=[33,126]
- `selectionMode` — type=enum, default=2
- `indexMode` — type=enum, default=0
- `indices` — type=string, default="first,last"
- `regex` — type=string, default="."
- `captureGroupIndices` — type=string, default=""
- `keepPunctuation` — type=bool, default=true
- `keepWhitespace` — type=bool, default=true
- `falloffs` — type=list

## value

Node identifier: value.
Supertype: behaviour.
Concrete attributes (4):
- `out`
- `value` — type=double, default=0
- `offset` — type=double, default=0
- `timeOffset` — type=double, default=0

## value2

Node identifier: value2.
Supertype: behaviour.
Concrete attributes (4):
- `out`
- `value` — type=double2
- `offset` — type=double2
- `timeOffset` — type=double, default=0

## value2Array

Node identifier: value2Array.
Supertype: indexableArray.
Concrete attributes (2):
- `array` — type=list, default={"list":[{}]}
- `out`

## value2Blend

Node identifier: value2Blend.
Supertype: behaviour.
Concrete attributes (4):
- `out`
- `strength`
- `firstValue` — type=double2
- `secondValue` — type=double2

## value3

Node identifier: value3.
Supertype: behaviour.
Concrete attributes (4):
- `out`
- `value` — type=double3
- `offset` — type=double3
- `timeOffset` — type=double, default=0

## value3Array

Node identifier: value3Array.
Supertype: indexableArray.
Concrete attributes (2):
- `array` — type=list, default={"list":[{}]}
- `out`

## value3Blend

Node identifier: value3Blend.
Supertype: behaviour.
Concrete attributes (4):
- `out`
- `strength`
- `firstValue` — type=double3
- `secondValue` — type=double3

## valueArray

Node identifier: valueArray.
Supertype: indexableArray.
Concrete attributes (6):
- `mode` — type=enum
- `autoIndex`
- `reverse`
- `arrayIndex`
- `array` — type=list, default={"list":[{}]}
- `out`

## valueBlend

Node identifier: valueBlend.
Supertype: behaviour.
Concrete attributes (4):
- `out`
- `strength`
- `firstValue` — type=double
- `secondValue` — type=double

## valueNoise

Node identifier: valueNoise.
Supertype: noiseEngine.
Concrete attributes (5):
- `octaves` — type=int, default=1
- `lacunarity` — type=double, default=2
- `gain` — type=double, default=0.5
- `curl` — type=bool, default=false
- `curlAmplitude` — type=double, default=50

## velocityContext

Node identifier: velocityContext.
Supertype: atomic.
Tags: beta.
Concrete attributes (4):
- `out` — type=double
- `strength` — type=double, default=100
- `normalise` — type=bool, default=false
- `offset` — type=double

## velocityMagnitudeContext

Node identifier: velocityMagnitudeContext.
Supertype: atomic.
Tags: beta.
Concrete attributes (3):
- `out` — type=double
- `strength` — type=double, default=100
- `offset` — type=double

## venetianBlinds

Node identifier: venetianBlinds.
Supertype: filter.
Concrete attributes (9):
- `matteApplyMode` — default=1
- `completion` — type=double, default=50
- `width` — type=double, default=50
- `feather` — type=double
- `direction` — type=double
- `distortion` — type=double
- `blindColor` — type=color, default={"r":255,"g":255,"b":255,"a":0}
- `opacity` — type=double, default=100
- `blendMode` — type=enum, default=1

## verticalLayout

Node identifier: verticalLayout.
Supertype: layoutItem.
Tags: beta.
Concrete attributes (8):
- `autoSpacing` — type=bool, default=false
- `paddingLR` — type=double2, default={"x":25,"y":25}
- `paddingTB` — type=double2, default={"x":25,"y":25}
- `spacing` — type=double, default=3
- `reverseLayout` — type=bool, default=false
- `invertLayout` — type=bool, default=false
- `shuffle` — type=bool, default=false
- `seed` — type=int, default=false

## vignetteFilter

Node identifier: vignetteFilter.
Supertype: filter.
Concrete attributes (12):
- `scale` — type=double2, default={"x":1,"y":1}
- `vignetteColor` — type=color, default={"r":0,"g":0,"b":0,"a":255}
- `sides` — type=int, default=5
- `vignetteShape` — type=enum, default=0
- `exposure` — type=double, default=-50
- `screenSpace` — type=bool, default=false
- `offset` — type=double2
- `hardness` — type=double, default=50
- `rotation` — type=double
- `opacity` — type=double, default=100
- `resolution` — type=int2
- `blendMode` — type=enum, default=1

## visibility

Node identifier: visibility.
Supertype: behaviourBase.
Concrete attributes (7):
- `start` — type=double, default=0
- `end` — type=double, default=100
- `travel` — type=int, default=0
- `invert` — type=bool
- `out`
- `alwaysOn` — type=string, default=""
- `alwaysOff` — type=string, default=""

## visibilityCollisionEvent

Node identifier: visibilityCollisionEvent.
Supertype: collisionEvent.
Concrete attributes (10):
- `mode` — type=enum
- `visibility` — type=bool, default=false
- `opacity` — type=double, default=50
- `fadeChanges` — type=bool, default=false
- `fadeTime` — type=double, default=1
- `useCollisionIndex` — type=bool, default=false
- `time` — type=int
- `specificCollisions` — type=bool, default=false
- `specificIndices` — type=string, default="0"
- `fps` — type=int

## visibilityCurve

Node identifier: visibilityCurve.
Supertype: animationCurveBase.
Concrete attributes (3):
- `out` — type=bool, default=true
- `range` — type=int2, default={"x":0,"y":0}
- `time` — type=double, default=0

## visualModifier

Node identifier: visualModifier.
Supertype: particleModifier.
Concrete attributes (10):
- `colorOverLifespan` — type=list
- `rotationScalar` — type=list
- `rotationOverLifespan` — type=double, default=360
- `scaleOverLifespan` — type=list
- `scaleStrength` — type=double, default=100
- `gradientMode` — type=enum
- `blendMode` — type=enum, default=1
- `colorMode` — type=enum, default=1
- `modifierColor` — type=color, default={"r":100,"g":55,"b":255,"a":255}
- `out` — type=ParticleShapeData

## voronoiShader

Node identifier: voronoiShader.
Supertype: shader.
Concrete attributes (25):
- `scale` — type=double2, default={"x":50,"y":50}
- `offset` — type=double2
- `rotation` — type=double
- `seed` — type=int
- `alpha` — type=double, default=100
- `greyscaleSeed` — type=int
- `distortionAmount` — type=double, default=100
- `loopLength` — type=int, default=60
- `time` — type=double, default=0
- `levels` — type=int, default=1
- `levelsDetail` — type=double, default=50
- `type` — type=enum, default=0
- `edgeWidth` — type=double, default=0.05
- `edgeFeather` — type=double, default=0.02
- `roundness` — type=double, default=0.1
- `style` — type=enum, default=0
- `equidistantEdges` — type=bool, default=false
- `edgeColor` — type=color
- `cellColor` — type=color, default={"r":79,"g":253,"b":122,"a":255}
- `level0Color` — type=color, default={"r":79,"g":253,"b":122,"a":255}
- `level1Color` — type=color, default={"r":100,"g":55,"b":255,"a":255}
- `level2Color` — type=color, default={"r":255,"g":36,"b":224,"a":255}
- `level3Color` — type=color, default={"r":255,"g":255,"b":0,"a":255}
- `level4Color` — type=color, default={"r":200,"g":200,"b":200,"a":255}
- `blendMode` — type=enum, default=3

## vortexField

Node identifier: vortexField.
Supertype: dynamicField.
Concrete attributes (8):
- `radius` — type=double, default=500
- `spiralStrength` — type=double, default=100
- `centripetalStrength` — type=double, default=0
- `angularStrength` — type=double, default=0.01
- `clockwise` — type=bool, default=true
- `generator` — type=nodeId
- `noiseAffects` — type=enum, default=0
- `noiseStrength` — type=double, default=50

## vortexModifier

Node identifier: vortexModifier.
Supertype: particlePhysicsModifier.
Concrete attributes (4):
- `physicsMode` — type=enum, default=0
- `forceVelocity` — type=double2, default={"x":137.5,"y":100}
- `customColor` — type=bool
- `drawColor` — type=color, default={"r":12,"g":226,"b":56,"a":255}

## voxelize

Node identifier: voxelize.
Supertype: behaviourBase.
Concrete attributes (5):
- `out`
- `size` — type=double, default=20
- `voxelScale` — type=double, default=1
- `screenSpace` — type=bool, default=false
- `resolution` — type=int2

## voxelizeDistribution

Node identifier: voxelizeDistribution.
Supertype: distribution.
Concrete attributes (4):
- `inputShape` — type=nodeId
- `size` — type=double, default=20
- `screenSpace` — type=bool, default=false
- `resolution` — type=int2

## wave

Node identifier: wave.
Supertype: behaviour.
Concrete attributes (7):
- `mode` — type=enum, default=0
- `numberOfWaves` — type=int, default=10
- `amplitude` — type=double, default=30
- `travel` — type=double, default=0
- `adaptiveWaveCounts` — type=bool
- `samplePoints` — type=int, default=30
- `outputBeziers` — type=bool, default=true

