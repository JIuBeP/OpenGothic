#include "physicvbo.h"

#include "collisionworld.h"

PhysicVbo::PhysicVbo(ZenLoad::PackedMesh&& sPacked)
  :PhysicVbo(sPacked.vertices) {
  id = std::move(sPacked.indices);
  for(auto& i:sPacked.subMeshes)
    if(!i.material.noCollDet && i.indexSize>0) {
      addSegment(i.indexSize,i.indexOffset,i.material.matGroup,nullptr);
      }
  for(size_t i=0;i<id.size();i+=3){
    std::swap(id[i+1],id[i+2]);
    }
  adjustMesh();
  }

PhysicVbo::PhysicVbo(const std::vector<ZenLoad::WorldVertex>& v)
  :vStorage(v.size()), vert(vStorage) {
  for(size_t i=0;i<v.size();++i){
    vStorage[i] = CollisionWorld::toMeters(v[i].Position);
    }
  }

PhysicVbo::PhysicVbo(const std::vector<btVector3>* v)
  :vert(*v) {
  }

void PhysicVbo::addIndex(std::vector<uint32_t>&& index, uint8_t material) {
  addIndex(std::move(index),material,nullptr);
  }

void PhysicVbo::addIndex(std::vector<uint32_t>&& index, uint8_t material, const char* sector) {
  if(index.size()==0)
    return;

  size_t off    = id.size();
  size_t idSize = index.size();
  if(id.size()==0) {
    id=std::move(index);
    for(size_t i=0;i<id.size();i+=3){
      std::swap(id[i+1],id[i+2]);
      }
    } else {
    id.resize(off+index.size());
    for(size_t i=0;i<index.size();i+=3){
      id[off+i+0] = index[i+0];
      id[off+i+1] = index[i+2];
      id[off+i+2] = index[i+1];
      }
    }

  addSegment(idSize,off,material,sector);
  adjustMesh();
  }

void PhysicVbo::addSegment(size_t indexSize, size_t offset, uint8_t material, const char* sector) {
  btIndexedMesh meshIndex={};
  meshIndex.m_numTriangles = int(indexSize/3);
  meshIndex.m_numVertices  = int32_t(vert.size());

  meshIndex.m_indexType           = PHY_INTEGER;
  meshIndex.m_triangleIndexBase   = reinterpret_cast<const uint8_t*>(&id[0]);
  meshIndex.m_triangleIndexStride = 3 * sizeof(id[0]);

  meshIndex.m_vertexBase          = reinterpret_cast<const uint8_t*>(&vert[0]);
  meshIndex.m_vertexStride        = sizeof(btVector3);

  m_indexedMeshes.push_back(meshIndex);

  Segment sgm;
  sgm.off    = offset;
  sgm.size   = int(indexSize/3);
  sgm.mat    = material;
  sgm.sector = sector;
  segments.push_back(sgm);
  }

uint8_t PhysicVbo::materialId(size_t segment) const {
  if(segment<segments.size())
    return segments[segment].mat;
  return 0;
  }

const char* PhysicVbo::sectorName(size_t segment) const {
  if(segment<segments.size())
    return segments[segment].sector;
  return nullptr;
  }

bool PhysicVbo::useQuantization() const {
  constexpr int maxParts = (1<<MAX_NUM_PARTS_IN_BITS);
  constexpr int maxTri   = (1 << (31 - MAX_NUM_PARTS_IN_BITS));
  if(segments.size()>maxParts)
    return false;
  for(auto& i:segments)
    if(i.size>maxTri)
      return false;
  return true;
  }

bool PhysicVbo::isEmpty() const {
  return segments.size()==0;
  }

void PhysicVbo::adjustMesh(){
  for(int i=0;i<m_indexedMeshes.size();++i) {
    btIndexedMesh& meshIndex=m_indexedMeshes[i];
    Segment&       sg       =segments[size_t(i)];

    meshIndex.m_triangleIndexBase = reinterpret_cast<const uint8_t*>(&id[sg.off]);
    meshIndex.m_numTriangles      = sg.size;
    }
  }

std::string_view PhysicVbo::validateSectorName(std::string_view name) const {
  if(name.empty())
    return "";
  for(auto& i:segments)
    if(name==i.sector)
      return i.sector;
  return "";
  }
