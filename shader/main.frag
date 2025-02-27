#version 450
#extension GL_ARB_separate_shader_objects : enable
#extension GL_GOOGLE_include_directive : enable

#define FRAGMENT
#include "shader_common.glsl"

layout(location = 0) in Varyings shInp;

layout(location = 0) out vec4 outColor;
#if defined(GBUFFER)
layout(location = 1) out vec4 outDiffuse;
layout(location = 2) out vec4 outNormal;
layout(location = 3) out vec4 outDepth;
#endif

float cookTorrance(vec3 normal, vec3 light, vec3 view, float roughness) {
  if(roughness<=0)
    return 0;

  vec3  hVec     = normalize(view+light );

  float NdotL    = max( dot(normal, light), 0.0 );
  float NdotV    = max( dot(normal, view ), 0.0 );
  float NdotH    = max( dot(normal, hVec ), 1.0e-7 );
  float VdotH    = max( dot(view,   hVec ), 0.0 );

  float geometric = 2.0 * NdotH / VdotH;
  geometric = min( 1.0, geometric * min(NdotV, NdotL) );

  float r_sq          = roughness * roughness;
  float NdotH_sq      = NdotH * NdotH;
  float NdotH_sq_r    = 1.0 / (NdotH_sq * r_sq);
  float roughness_exp = (NdotH_sq - 1.0) * ( NdotH_sq_r );
  float r     = exp(roughness_exp) * NdotH_sq_r / (4.0 * NdotH_sq );

  float fresnel       = 1.0/(1.0+NdotV);

  return min(1.0, (fresnel * geometric * r) / (NdotV * NdotL + 1.0e-7));
  }

#if !defined(SHADOW_MAP)
vec4 shadowSample(in sampler2D shadowMap, vec2 shPos) {
  shPos.xy = shPos.xy*vec2(0.5,0.5)+vec2(0.5);
  return textureGather(shadowMap,shPos);
  }

float shadowResolve(in vec4 sh, float z, float bias) {
  z += (bias/65535.0);
  z  = max(0,z);
  sh = step(sh,vec4(z));
  return 0.25*(sh.x+sh.y+sh.z+sh.w);
  }

float calcShadow(vec3 shPos0, vec3 shPos1) {
  vec4  lay0 = shadowSample(textureSm0,shPos0.xy);
  vec4  lay1 = shadowSample(textureSm1,shPos1.xy);

  float v0   = shadowResolve(lay0,shPos0.z,4.0);
  float v1   = shadowResolve(lay1,shPos1.z,1.0);

  if(abs(shPos0.x)<1.0 && abs(shPos0.y)<1.0 && ((0.45<lay1.x && lay1.x<0.55) || lay1.x==0))
    return v0;
  if(abs(shPos1.x)<1.0 && abs(shPos1.y)<1.0)
    return v1;
  return 1.0;
  }

float calcShadow() {
  vec3 shPos0  = (shInp.shadowPos[0].xyz)/shInp.shadowPos[0].w;
  vec3 shPos1  = (shInp.shadowPos[1].xyz)/shInp.shadowPos[1].w;
  return calcShadow(shPos0,shPos1);
  }
#endif

#if !defined(SHADOW_MAP)
vec3 calcLight() {
  vec3  normal  = normalize(shInp.normal);
  float lambert = max(0.0,dot(scene.ldir,normal));
  float light   = lambert*calcShadow();
  vec3  color   = scene.sunCl.rgb*clamp(light,0.0,1.0);

  /*
  for(int i=0; i<LIGHT_BLOCK; ++i) {
    float rgn     = push.light[i].range;
    if(rgn<=0.0)
      continue;
    vec3  ldir    = push.light[i].pos.xyz - inPos.xyz;
    float qDist   = dot(ldir,ldir);
    float lambert = max(0.0,dot(normalize(ldir),normal));

    // return vec3(lambert);
    // return vec3(length(ldir/rgn));

    float light = (1.0-(qDist/(rgn*rgn)))*lambert;

    color += push.light[i].color * clamp(light,0.0,1.0);
    }*/

  return color + scene.ambient;
  }
#endif

#if defined(WATER)
vec3 waterColor(vec3 selfColor) {
  vec3  scr    = shInp.scr.xyz/shInp.scr.w;
  vec2  p      = scr.xy*0.5+vec2(0.5);
  vec4  back   = texture(gbufferDiffuse,p);
  float depth  = texture(gbufferDepth,  p).r;

  vec4  ground = scene.viewProjectInv*vec4(scr.xy,depth,1.0);
  vec4  water  = scene.viewProjectInv*vec4(scr,1.0);

  float dist  = distance(water.xyz/water.w, ground.xyz/ground.w)/100.0;
  dist = pow(dist,2);
  float a     = min(dist,0.8);
  return mix(back.rgb,selfColor,a);
  }
#endif

#if defined(GHOST)
vec3 ghostColor(vec3 selfColor) {
  vec3  scr   = shInp.scr.xyz/shInp.scr.w;
  vec2  p     = scr.xy*0.5+vec2(0.5);
  vec4  back  = texture(gbufferDiffuse,p);
  return back.rgb+selfColor;
  }
#endif

void main() {
#if !defined(SHADOW_MAP) || defined(ATEST)
  vec4 t = texture(textureD,shInp.uv);
#  ifdef ATEST
  if(t.a<0.5)
    discard;
#  endif
#endif

#if defined(SHADOW_MAP)
  outColor = vec4(shInp.scr.zzz/shInp.scr.w,0.0);
#else

  vec3  color = vec3(0);
  float alpha = 1;

#if defined(GHOST)
  color = ghostColor(t.rgb);
  alpha = t.a;
#else
  color = t.rgb;
  alpha = t.a;
#endif

#if defined(VCOLOR)
  color *= shInp.color.rgb;
  alpha *= shInp.color.a;
#endif

#if defined(LIGHT)
  color *= calcLight();
#endif

#if defined(WATER)
  {
    vec4  cam   = scene.viewProjectInv[3];
    vec3  view  = normalize(shInp.pos - cam.xyz/cam.w);
    float rs    = cookTorrance(shInp.normal,scene.ldir,-view,0.01);
    color = waterColor(color) + vec3(rs);
    //color = vec3(shInp.pos/1000.f);
    alpha = 1;
  }
#endif

  outColor      = vec4(color,alpha);
#ifdef GBUFFER
  outDiffuse    = t;
  outNormal     = vec4(normalize(shInp.normal)*0.5 + vec3(0.5),1.0);
  outDepth      = vec4(shInp.scr.z/shInp.scr.w,0.0,0.0,0.0);
#endif

  //outColor = vec4(inZ.xyz/inZ.w,1.0);
  //outColor = vec4(vec3(inPos.xyz)/1000.0,1.0);
  //outColor = vec4(vec3(shMap),1.0);
  //outColor = vec4(vec3(calcLight()),1.0);
  //outColor = vec4(vec3(calcShadow()),1.0);
  //vec3 shPos0  = (shInp.shadowPos[0].xyz)/shInp.shadowPos[0].w;
  //outColor   = vec4(vec3(shPos0.xy,0),1.0);
#endif
  }
