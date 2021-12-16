// algorithm from Wikipedia: https://en.wikipedia.org/wiki/3D_projection
/*
a(x, y, z) is the 3D position of the point to be projected
c(x, y, z) is the 3D position of the camera
o(x, y, z) is the camera rotation (tait-bryan angles)
e(x, y, z) is the position of the display surface (set to 0, 0, 1)

*/
const canvas = document.getElementById("mainCanvas");
const height = canvas.height;
const width = canvas.width;
const ctx = canvas.getContext("2d");
function transformPoint(c, a, ox, oy, oz){
	let x = a[0] - c[0];
	let y = a[1] - c[1];
	let z = a[2] - c[2];

	let dx = Math.cos(oy) * (Math.sin(oz) * y + Math.cos(oz) * x) - Math.sin(oy) * z;
	let dy = Math.sin(ox) * (Math.cos(oy) * z + Math.sin(oy) * (Math.sin(oz) * y + Math.cos(oz) * x)) + Math.cos(ox) * (Math.cos(oz) * y - Math.sin(oz) * x);
	let dz = Math.cos(ox) * (Math.cos(oy) * z + Math.sin(oy) * (Math.sin(oz) * y + Math.cos(oz) * x)) - Math.sin(ox) * (Math.cos(oz) * y - Math.sin(oz) * x);

	return [dx, dy, dz];
}

function projectPoint(d, ex, ey, ez){
	if (d[2] == 0) d[2] == 0.001
	let bx = (ez / d[2]) * d[0] + ex;
	let by = (ez / d[2]) * d[1] + ey;

	if (bx == NaN || by == NaN) console.log("HEY!");
	return [bx, by];
}

const KEYS = {};

document.addEventListener('keydown', function(e){
	if (e.key == "Enter"){
		showLabels = !showLabels;
	}
	KEYS[e.key] = true;
});

document.addEventListener('keyup', function(e){
	KEYS[e.key] = false;
});

/*

How the system works: In order to deal with points behind the camera, each edge will be simulated individually.
We'll work with triangles, basically using 3 points in space, and for each one we'll take every two points
and check a few things.
If both points are behind the camera, we'll just ignore that line.
If both points are in front of the camera, we can just render a line between them as normal.
If one point is behind the camera but the other isn't, we'll need to find the point on this line which intersects
the camera plane.
The way to do this is by finding the difference between the two points, then using that to find it.
Like this:
p1 = 1, 1, 1, p2 = -1, -1, -1
difference = 2, 2, 2
divide/multiply difference by a number, such that it's the same ratio but z is equal to the z of p1.
2 * x = 1, x = 1 / 2
SO: multiply it by p1(z) / difference(z) or 
in this case: difference *= 1/2
so difference = 1, 1, 1
then just subtract difference from p1, getting 0, 0, 0 in this case


Now that we have all of our points resolved, we add points in groups of two to the projection algorithm and then 
render the resulting lines.

*/

// let shapes = [
// 	[
// 		[[-1, 0, 0], [-1, 0, 5]], [[-1, 0, 5], [1, 0, 5]], [[1, 0, 5], [1, 0, 0]], [[1, 0, 0], [-1, 0, 0]]
// 	],
// 	[
// 		[[1, 1, 1], [0, 1, 1]], [[0, 1, 1], [1, 0, 1]], [[1, 0, 1], [1, 1, 1]]
// 	]
// ];
alert ("Welcome to my demonstration! Use W, A, S, and D to move and the arrow keys to look around.");
let shapes = [
	[
		[[-2, 0, 1], [2, 0, 1]], [[-2, 0, 1], [-2, 0, 10]], [[2, 0, 1], [2, 0, 10]], [[-2, 0, 10], [2, 0, 10]]
	],
	[
		[[1, 0, 3], [1, 3, 3]], [[1.5, 3, 3.5], [0.5, 3, 3.5]], [[0.5, 3, 3.5], [0.5, 3, 2.5]], [[0.5, 3, 2.5], [1.5, 3, 2.5]], [[1.5, 3, 2.5], [1.5, 3, 3.5]], [[1.5, 3, 3.5], [0.5, 3, 2.5]], [[1.5, 3, 2.5], [0.5, 3, 3.5]]
	]
];
let text = [
	[1, 1.3, 3, "tree"],
	[0, 0.1, 1, "ground"],
	[0.5, 3, 3, "leaves"]
];

let showLabels = false;

let cameraPos = [0.5, 0.5, -0.001];

let cameraRot = [0, 0, 3.15];

let viewDistance = 360;

let clippingPlane = 0;

let movement = [0, 0, 0];

function gameLoop(){
	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, 1000, 1000);

	ctx.fillStyle = "black";
	ctx.beginPath();


	// What we want to do: First, transform every point.
	let coords = [];
	let textCoords = [];
	for (let i = 0; i < shapes.length; ++i){
		coords.push([]);
		for (let l = 0; l < shapes[i].length; ++l){
			coords[i].push([]);
			coords[i][l].push(transformPoint(cameraPos, shapes[i][l][0], cameraRot[0], cameraRot[1], cameraRot[2]));
			coords[i][l].push(transformPoint(cameraPos, shapes[i][l][1], cameraRot[0], cameraRot[1], cameraRot[2]));
		}
	}
	for (let i = 0; i < text.length; ++i){
		textCoords[i] = transformPoint(cameraPos, text[i], cameraRot[0], cameraRot[1], cameraRot[2]);
	}

	// Then, we do the logic and clip points. By this point we should have three pairs of points, one for each edge.
	// For each pair, check the z value of each point. If both points are in positive z, ignore them.
	// If both points are negative z, don't render them.
	// If one is positive and the other is negative, we get to do some math!
	// Let the point with positive z be p1 and the other be p1. let d = the positive difference between p 1 and 2
	// let x = p1(z) / d(z), then divide all coordinates in d by x
	// now, p2 = p2 + d and you're done!
	// for (let s = 0; s < coords.length; ++s){
	// 	for (let l = 0; l < coords[s].length; ++l){
	// 		if (coords[s][l][0][2] >= 0 && coords[s][l][1][2] >= 0){
	// 			// Both points in current line are positive z
	// 		}
	// 		else if (coords[s][l][0][2] < 0 && coords[s][l][1][2] < 0){
	// 			coords[s][l] = [[0, 0, 0], [0, 0, 0]]
	// 		}
	// 		else{
	// 			// One point's positive and the other's negative

	// 			if (coords[s][l][0][2] < 0){
	// 				// first point's behind
					

	// 			}

	// 			// let difference = [];
	// 			// let num;
	// 			// let p1;
	// 			// let p2;
	// 			// for (let n = 0; n < 3; ++n){
	// 			// 	p1 = coords[s][l][0][n];
	// 			// 	p2 = coords[s][l][1][n];
	// 			// 	if ((p1 >= 0 && p2 >= 0) || (p1 <= 0 && p2 <= 0)){
	// 			// 		difference[n] = Math.abs(Math.abs(p1) - Math.abs(p2));
	// 			// 	}
	// 			// 	else{
	// 			// 		difference[n] = Math.abs(p1) + Math.abs(p2);
	// 			// 	}
	// 			// }
	// 			// if (coords[s][l][0][2] > coords[s][l][1][2]){
	// 			// 	num = coords[s][l][1][2] / -difference[2];
	// 			// }
	// 			// if (coords[s][l][1][2] > coords[s][l][0][2]){
	// 			// 	num = coords[s][l][0][2] / -difference[2];
	// 			// }
	// 			// for (let n = 0; n < 3; ++n){
	// 			// 	difference[n] *= num;
	// 			// }

	// 			// if (coords[s][l][0][2] > coords[s][l][1][2]){
	// 			// 	for (let n = 0; n<3; ++n){
	// 			// 		coords[s][l][1][n] += difference[n]
	// 			// 	}
	// 			// 	coords[s][l][1][2] = 0;
	// 			// }
	// 			// if (coords[s][l][1][2] > coords[s][l][0][2]){
	// 			// 	for (let n = 0; n<3; ++n){
	// 			// 		coords[s][l][0][n] += difference[n]
	// 			// 	}
	// 			// }
	// 		}
	// 	}
	// }

	// Now that every point is transformed properly, we want to project each point and draw the lines.
	let p1 = [];
	let p2 = [];
	for (let s = 0; s < coords.length; ++s){

		for (let l = 0; l < coords[s].length; ++l){
			if (coords[s][l][0][2] >= clippingPlane && coords[s][l][1][2] >= clippingPlane){
				// Both points in current line are positive z
				ctx.moveTo(projectPoint(coords[s][l][0], 0, 0, viewDistance)[0] + width/2, projectPoint(coords[s][l][0], 0, 0, viewDistance)[1] + height/2);
				ctx.lineTo(projectPoint(coords[s][l][1], 0, 0, viewDistance)[0] + width/2, projectPoint(coords[s][l][1], 0, 0, viewDistance)[1] + height/2);
			}
			else if (coords[s][l][0][2] < clippingPlane && coords[s][l][1][2] < clippingPlane){

			}
			else{
				if (coords[s][l][0][2] < clippingPlane){
					p1 = [projectPoint(coords[s][l][0], 0, 0, viewDistance)[0] + width/2, projectPoint(coords[s][l][0], 0, 0, viewDistance)[1] + height/2];
					p2 = [projectPoint(coords[s][l][1], 0, 0, viewDistance)[0] + width/2, projectPoint(coords[s][l][1], 0, 0, viewDistance)[1] + height/2];
				}
				else {
					p1 = [projectPoint(coords[s][l][1], 0, 0, viewDistance)[0] + width/2, projectPoint(coords[s][l][1], 0, 0, viewDistance)[1] + height/2];
					p2 = [projectPoint(coords[s][l][0], 0, 0, viewDistance)[0] + width/2, projectPoint(coords[s][l][0], 0, 0, viewDistance)[1] + height/2];
				}

				let dx = p2[0] - p1[0];
				let dy = p2[1] - p1[1];
				p1[0] = p2[0] + dx * 10;
				p1[1] = p2[1] + dy * 10;
				ctx.moveTo(p1[0], p1[1]);
				ctx.lineTo(p2[0], p2[1]);
			}
		}
	}
	if (showLabels){
		for (let s = 0; s < textCoords.length; ++s){
			if (textCoords[s][2] >= clippingPlane){
				// Both points in current line are positive z
				ctx.font = "20px arial";
				ctx.fillText(text[s][3], projectPoint(textCoords[s], 0, 0, viewDistance)[0] + width/2, projectPoint(textCoords[s], 0, 0, viewDistance)[1] + height/2);
			}
		}
	}
		
	ctx.stroke();

	if (KEYS["ArrowLeft"]){
		cameraRot[1] -= 0.01;
	}
	if (KEYS["ArrowRight"]){
		cameraRot[1] += 0.01;
	}
	if (KEYS["ArrowUp"]){
		cameraRot[0] += 0.01;
	}
	if (KEYS["ArrowDown"]){
		cameraRot[0] -= 0.01;
	}
	// if (KEYS["."]){
	// 	cameraPos[2] += 0.01;
	// }
	// if (KEYS[","]){
	// 	cameraPos[2] -= 0.01;
	// }
	// if (KEYS["q"]){
	// 	cameraRot[1] += 0.01;
	// };
	// if (KEYS["e"]){
	// 	cameraRot[1] -= 0.01;
	// }
	if (KEYS["w"]){
		cameraPos[2] += 0.01 * Math.cos(cameraRot[1]);
		cameraPos[0] -= 0.01 * Math.sin(cameraRot[1]);
	}
	if (KEYS["s"]){
		cameraPos[2] -= 0.01 * Math.cos(cameraRot[1]);
		cameraPos[0] += 0.01 * Math.sin(cameraRot[1]);
	}
	if (KEYS["a"]){
		cameraPos[2] += 0.01 * Math.sin(cameraRot[1]);
		cameraPos[0] += 0.01 * Math.cos(cameraRot[1]);
	}
	if (KEYS["d"]){
		cameraPos[2] -= 0.01 * Math.sin(cameraRot[1]);
		cameraPos[0] -= 0.01 * Math.cos(cameraRot[1]);
	}
	if (KEYS["r"]){
		cameraPos = [0.5, 0.5, -0.001];
		cameraRot = [0, 0, 3.15];
	}
}

window.setInterval(gameLoop, 10)