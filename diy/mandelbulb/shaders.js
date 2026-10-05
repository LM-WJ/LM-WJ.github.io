const VS = `
attribute vec2 p;
void main(){gl_Position=vec4(p,0,1);}
`;

const FS = `
precision highp float;
uniform vec2 res;
uniform float time, power, iters, zoom, rotX, rotY, speed, lightMode;

float bulb(vec3 pos){
  vec3 z=pos; float dr=1.,r=0.;
  for(int i=0;i<14;i++){
    if(float(i)>=iters) break;
    r=max(length(z),.0000001); if(r>2.) break;
    float th=acos(clamp(z.z/r,-1.,1.));
    float ph=dot(z.xy,z.xy)<.000000000001?0.:atan(z.y,z.x);
    dr=pow(r,power-1.)*power*dr+1.;
    float zr=pow(r,power);
    z=zr*vec3(sin(th*power)*cos(ph*power),
               sin(th*power)*sin(ph*power),
               cos(th*power))+pos;
  }
  return .5*log(r)*r/dr;
}

vec3 norm(vec3 p){
  float e=.001;
  return normalize(vec3(
    bulb(p+vec3(e,0,0))-bulb(p-vec3(e,0,0)),
    bulb(p+vec3(0,e,0))-bulb(p-vec3(0,e,0)),
    bulb(p+vec3(0,0,e))-bulb(p-vec3(0,0,e))));
}

mat3 ry(float a){return mat3(cos(a),0,sin(a),0,1,0,-sin(a),0,cos(a));}
mat3 rx(float a){return mat3(1,0,0,0,cos(a),-sin(a),0,sin(a),cos(a));}

void main(){
  vec2 uv=(gl_FragCoord.xy/res)*2.-1.;
  uv.x*=res.x/res.y;
  float ang=time*speed+rotY;
  mat3 rot=rx(rotX)*ry(ang);
  vec3 ro=rot*vec3(0,0,zoom);
  vec3 rd=normalize(rot*vec3(uv,-2.));
  float t=0.;
  vec3 background=pow(mix(vec3(.055,.105,.14),vec3(.91,.94,.91),lightMode),vec3(2.2));
  vec3 col=background;
  for(int i=0;i<90;i++){
    vec3 p=ro+rd*t;
    float d=bulb(p);
    if(d<.0008){
      vec3 n=norm(p);
      vec3 l1=normalize(vec3(1.5,2.,1.));
      vec3 l2=normalize(vec3(-1.,-1.,.5));
      float diff=max(dot(n,l1),0.)*0.7+max(dot(n,l2),0.)*0.2;
      float spec=pow(max(dot(reflect(-l1,n),-rd),0.),48.)*0.5;
      float ao=1.-float(i)/90.;
      vec3 baseCol=mix(vec3(.05,.2,.55),vec3(.95,.5,.05),1.-ao);
      baseCol=mix(baseCol,vec3(.4,.8,.9),ao*ao*.3);
      col=(baseCol*(0.1+diff)+vec3(.9,.95,1.)*spec)*ao;
      col=mix(col,background,smoothstep(0.,1.,t/7.)*mix(1.,.2,lightMode));
      break;
    }
    t+=max(d*.7,.002);
    if(t>9.) break;
  }
  col=pow(max(col,0.),vec3(.4545));
  gl_FragColor=vec4(col,1.);
}
`;
