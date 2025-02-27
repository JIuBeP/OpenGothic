#pragma once

#include <tuple>
#include <daedalus/DaedalusStdlib.h>

#include "game/constants.h"

class Npc;
class Bullet;

class DamageCalculator {
  public:
    enum {
      MinDamage = 5
      };

    enum {
      DAM_INDEX_MAX = Daedalus::GEngineClasses::DAM_INDEX_MAX
      };

    struct Val final {
      Val()=default;
      Val(int32_t v,bool b):value(v),hasHit(b){}
      Val(int32_t v,bool b,bool i):value(v),hasHit(b),invinsible(i){}

      int32_t value      = 0;
      bool    hasHit     = false;
      bool    invinsible = false;
      };

    struct Damage final {
      int32_t  val[DAM_INDEX_MAX] = {};
      int32_t& operator[](size_t i) { return val[i]; }
      void     operator *= (int32_t v) { for(auto& i:val) i*=v; }
      void     operator /= (int32_t v) { for(auto& i:val) i/=v; }
      };

    static Val     damageValue(Npc& src, Npc& other, const Bullet* b, bool isSpell, const DamageCalculator::Damage& splDmg, const CollideMask bMsk);
    static Val     damageFall(Npc& src, float speed);
    static auto    rangeDamageValue(Npc& src) -> Damage;
    static int32_t damageTypeMask(Npc& npc);

  private:
    static bool    checkDamageMask(Npc& src, Npc& other, const Bullet* b);

    static Val     rangeDamage(Npc& src, Npc& other, const Bullet& b, const CollideMask bMsk);
    static Val     rangeDamage(Npc& src, Npc& other, Damage dmg, const CollideMask bMsk);
    static Val     swordDamage(Npc& src, Npc& other);
  };

