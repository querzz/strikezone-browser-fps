import * as T from 'three';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const scene=new T.Scene();scene.background=new T.Color(0x89a8ba);
const camera=new T.PerspectiveCamera(75,innerWidth/innerHeight,.1,200);camera.position.set(0,1.7,12);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);
const controls=new PointerLockControls(camera,document.body),clock=new T.Clock(),ray=new T.Raycaster(),keys={},walls=[],bots=[];
scene.add(new T.HemisphereLight(0xffffff,0x444444,3));
const floor=new T.Mesh(new T.PlaneGeometry(80,80),new T.MeshStandardMaterial({color:0x626858}));floor.rotation.x=-Math.PI/2;scene.add(floor);
function box(x,z,w,h,d){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:0x9a8060}));m.position.set(x,h/2,z);scene.add(m);walls.push(m);}
box(0,-30,60,6,2);box(0,30,60,6,2);box(-30,0,2,6,60);box(30,0,2,6,60);box(-9,-4,8,4,3);box(10,5,8,4,3);box(0,-15,6,4,3);
let hp=100,ammo=30,reserve=90,reload=0,kills=0,active=true;const hud=document.querySelector('#hud'),button=document.querySelector('#start');
function spawn(){for(const b of bots)scene.remove(b.mesh);bots.length=0;for(const [x,z] of [[-18,-18],[18,-18],[-18,18],[18,18]]){const m=new T.Mesh(new T.CapsuleGeometry(.45,1,4,8),new T.MeshStandardMaterial({color:0xbd3030}));m.position.set(x,1,z);scene.add(m);bots.push({mesh:m,hp:100,cd:2});}hp=100;ammo=30;reserve=90;kills=0;reload=0;active=true;camera.position.set(0,1.7,12);}
button.onclick=()=>{if(!active)spawn();controls.lock();};controls.addEventListener('lock',()=>button.hidden=true);controls.addEventListener('unlock',()=>button.hidden=false);
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyR'&&!reload&&ammo<30&&reserve>0)reload=1.3;});addEventListener('keyup',e=>keys[e.code]=false);addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
addEventListener('mousedown',e=>{if(e.button!==0||!controls.isLocked||!active||reload||ammo<=0)return;ammo--;ray.setFromCamera(new T.Vector2(),camera);const hit=ray.intersectObjects([...walls,...bots.map(b=>b.mesh)],false)[0];const b=bots.find(b=>b.mesh===hit?.object);if(b){b.hp-=50;if(b.hp<=0){scene.remove(b.mesh);bots.splice(bots.indexOf(b),1);kills++;}}});
const loader=new GLTFLoader();loader.load('https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',g=>{const prop=g.scene;prop.scale.setScalar(.5);prop.position.set(23,0,0);scene.add(prop);},undefined,e=>console.warn('Online model unavailable; gameplay remains available.',e));
function blocked(p){return walls.some(w=>new T.Box3().setFromObject(w).expandByScalar(.35).containsPoint(p));}
spawn();
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05);if(active&&controls.isLocked){if(reload>0){reload-=dt;if(reload<=0){reload=0;const n=Math.min(30-ammo,reserve);ammo+=n;reserve-=n;}}const old=camera.position.clone(),s=(keys.ShiftLeft?7:5)*dt;controls.moveForward(((keys.KeyW?1:0)-(keys.KeyS?1:0))*s);controls.moveRight(((keys.KeyD?1:0)-(keys.KeyA?1:0))*s);if(blocked(camera.position))camera.position.copy(old);for(const b of bots){const dir=camera.position.clone().sub(b.mesh.position);dir.y=0;const dist=dir.length();const before=b.mesh.position.clone();if(dist>5)b.mesh.position.addScaledVector(dir.normalize(),dt*1.2);if(blocked(b.mesh.position))b.mesh.position.copy(before);b.cd-=dt;if(dist<20&&b.cd<=0){b.cd=1;ray.set(b.mesh.position,camera.position.clone().sub(b.mesh.position).normalize());const obstruction=ray.intersectObjects(walls,false)[0];if(!obstruction||obstruction.distance>dist)hp-=8;}}if(hp<=0||bots.length===0){active=false;controls.unlock();}}hud.textContent=`HP ${Math.max(0,hp)} | ${ammo}/${reserve} | Устранено: ${kills} | ${reload?'Перезарядка':active?'WASD · ЛКМ · R · Shift':hp<=0?'Поражение':'Победа'}`;renderer.render(scene,camera);}frame();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
