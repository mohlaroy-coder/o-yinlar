import * as THREE from 'three';
import { CharacterSkin, WeaponId } from './types';
import { createWeaponMesh } from './weapons';

export interface CharacterAnimationState {
  moveSpeed: number; // 0..1+
  isSprinting: boolean;
  isCrouching: boolean;
  isAirborne: boolean;
  isParachuting: boolean;
  isSkydiving: boolean;
  isAds: boolean;
  shootRecoil: number;
  reloadProgress: number; // 0..1 (0 = not reloading)
  time: number;
  pitch: number;
}

export class HumanCharacterRig {
  public readonly root: THREE.Group;
  public readonly bodyPivot: THREE.Group;
  public readonly headGroup: THREE.Group;
  public readonly torsoMesh: THREE.Mesh;
  public readonly vestMesh: THREE.Mesh;
  public readonly helmetGroup: THREE.Group;
  public readonly backpackGroup: THREE.Group;
  public readonly leftArmPivot: THREE.Group;
  public readonly rightArmPivot: THREE.Group;
  public readonly leftLegPivot: THREE.Group;
  public readonly rightLegPivot: THREE.Group;
  public readonly weaponMount: THREE.Group;
  public readonly parachuteGroup: THREE.Group;
  public readonly contactShadow: THREE.Mesh;

  private weaponMesh: THREE.Group | null = null;
  private currentWeaponId: WeaponId | null = null;

  private shirtMat: THREE.MeshStandardMaterial;
  private pantsMat: THREE.MeshStandardMaterial;
  private vestMat: THREE.MeshStandardMaterial;
  private bootMat: THREE.MeshStandardMaterial;
  private skinMat: THREE.MeshStandardMaterial;
  private hairMat: THREE.MeshStandardMaterial;
  private helmetMat: THREE.MeshStandardMaterial;
  private backpackMat: THREE.MeshStandardMaterial;

  constructor(skin: CharacterSkin, shadowTexture?: THREE.Texture) {
    this.root = new THREE.Group();
    this.bodyPivot = new THREE.Group();
    this.root.add(this.bodyPivot);

    this.shirtMat = new THREE.MeshStandardMaterial({ color: skin.shirtColor, roughness: 0.78, metalness: 0.06 });
    this.pantsMat = new THREE.MeshStandardMaterial({ color: skin.pantsColor, roughness: 0.85, metalness: 0.04 });
    this.vestMat = new THREE.MeshStandardMaterial({ color: skin.vestColor, roughness: 0.55, metalness: 0.25 });
    this.bootMat = new THREE.MeshStandardMaterial({ color: skin.bootColor, roughness: 0.65, metalness: 0.15 });
    this.skinMat = new THREE.MeshStandardMaterial({ color: skin.skinTone, roughness: 0.68, metalness: 0.02 });
    this.hairMat = new THREE.MeshStandardMaterial({ color: skin.hairColor, roughness: 0.82, metalness: 0.05 });
    this.helmetMat = new THREE.MeshStandardMaterial({ color: 0x2f3630, roughness: 0.42, metalness: 0.38 });
    this.backpackMat = new THREE.MeshStandardMaterial({ color: 0x454a3a, roughness: 0.78, metalness: 0.08 });

    // Contact shadow grounding plane
    const shadowGeo = new THREE.PlaneGeometry(1.15, 1.15);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture || null,
      color: 0x000000,
      transparent: true,
      opacity: shadowTexture ? 0.55 : 0.0,
      depthWrite: false,
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.position.y = 0.03;
    this.root.add(this.contactShadow);

    // 1. Torso & Tactical Vest
    this.torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.54, 0.24), this.shirtMat);
    this.torsoMesh.position.y = 1.12;
    this.torsoMesh.castShadow = true;
    this.bodyPivot.add(this.torsoMesh);

    this.vestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.28), this.vestMat);
    this.vestMesh.position.y = 1.13;
    this.vestMesh.castShadow = true;
    this.bodyPivot.add(this.vestMesh);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.26), this.bootMat);
    belt.position.y = 0.86;
    this.bodyPivot.add(belt);

    // 2. Backpack (level 1-3 visibility)
    this.backpackGroup = new THREE.Group();
    const packMain = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.16), this.backpackMat);
    packMain.position.set(0, 1.15, 0.19);
    const packPouch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.06), this.vestMat);
    packPouch.position.set(0, 1.04, 0.28);
    packMain.castShadow = true;
    this.backpackGroup.add(packMain, packPouch);
    this.backpackGroup.visible = false;
    this.bodyPivot.add(this.backpackGroup);

    // 3. Head, Face, Hair & Helmet
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.46, 0);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.1, 10), this.skinMat);
    neck.position.y = -0.02;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.23), this.skinMat);
    head.position.y = 0.12;
    head.castShadow = true;

    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.08, 0.24), this.hairMat);
    hair.position.set(0, 0.22, 0.01);

    const goggles = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.05, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x15191f, roughness: 0.2, metalness: 0.7 })
    );
    goggles.position.set(0, 0.14, -0.11);

    this.helmetGroup = new THREE.Group();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      this.helmetMat
    );
    dome.position.set(0, 0.16, 0.0);
    dome.castShadow = true;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.158, 0.162, 0.04, 14), this.helmetMat);
    brim.position.set(0, 0.15, 0.0);
    this.helmetGroup.add(dome, brim);
    this.helmetGroup.visible = false;

    this.headGroup.add(neck, head, hair, goggles, this.helmetGroup);
    this.bodyPivot.add(this.headGroup);

    // 4. Arms (pivoted at shoulders)
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.27, 1.33, 0);
    const lUpper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.12), this.shirtMat);
    lUpper.position.y = -0.15;
    lUpper.castShadow = true;
    const lFore = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.26, 0.105), this.skinMat);
    lFore.position.y = -0.4;
    const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.1), this.bootMat);
    lGlove.position.y = -0.53;
    this.leftArmPivot.add(lUpper, lFore, lGlove);
    this.bodyPivot.add(this.leftArmPivot);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.27, 1.33, 0);
    const rUpper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.12), this.shirtMat);
    rUpper.position.y = -0.15;
    rUpper.castShadow = true;
    const rFore = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.26, 0.105), this.skinMat);
    rFore.position.y = -0.4;
    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.1), this.bootMat);
    rGlove.position.y = -0.53;

    this.weaponMount = new THREE.Group();
    this.weaponMount.position.set(-0.04, -0.48, -0.12);
    this.weaponMount.rotation.x = Math.PI / 2;
    this.rightArmPivot.add(rUpper, rFore, rGlove, this.weaponMount);
    this.bodyPivot.add(this.rightArmPivot);

    // 5. Legs (pivoted at hips)
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.11, 0.84, 0);
    const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), this.pantsMat);
    lThigh.position.y = -0.21;
    lThigh.castShadow = true;
    const lShin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), this.pantsMat);
    lShin.position.y = -0.55;
    lShin.castShadow = true;
    const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.22), this.bootMat);
    lBoot.position.set(0, -0.76, -0.03);
    lBoot.castShadow = true;
    this.leftLegPivot.add(lThigh, lShin, lBoot);
    this.bodyPivot.add(this.leftLegPivot);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.11, 0.84, 0);
    const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), this.pantsMat);
    rThigh.position.y = -0.21;
    rThigh.castShadow = true;
    const rShin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), this.pantsMat);
    rShin.position.y = -0.55;
    rShin.castShadow = true;
    const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.22), this.bootMat);
    rBoot.position.set(0, -0.76, -0.03);
    rBoot.castShadow = true;
    this.rightLegPivot.add(rThigh, rShin, rBoot);
    this.bodyPivot.add(this.rightLegPivot);

    // 6. Parachute Canopy Group
    this.parachuteGroup = new THREE.Group();
    const canopyMat = new THREE.MeshStandardMaterial({
      color: skin.accentColor,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const canopy = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.6, 1.1, 10, 1, true, 0, Math.PI),
      canopyMat
    );
    canopy.rotation.z = Math.PI / 2;
    canopy.rotation.y = Math.PI / 2;
    canopy.position.y = 4.2;
    canopy.scale.set(0.85, 1, 1.35);

    const cordMat = new THREE.MeshBasicMaterial({ color: 0xd1d5db });
    const cordOffsets: Array<[number, number]> = [
      [-1.3, -0.6],
      [1.3, -0.6],
      [-1.3, 0.6],
      [1.3, 0.6],
    ];
    for (const [cx, cz] of cordOffsets) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.1, 4), cordMat);
      cord.position.set(cx * 0.55, 2.7, cz * 0.55);
      cord.rotation.z = -cx * 0.28;
      cord.rotation.x = cz * 0.28;
      this.parachuteGroup.add(cord);
    }
    this.parachuteGroup.add(canopy);
    this.parachuteGroup.visible = false;
    this.root.add(this.parachuteGroup);
  }

  public applySkin(skin: CharacterSkin): void {
    this.shirtMat.color.setHex(skin.shirtColor);
    this.pantsMat.color.setHex(skin.pantsColor);
    this.vestMat.color.setHex(skin.vestColor);
    this.bootMat.color.setHex(skin.bootColor);
    this.skinMat.color.setHex(skin.skinTone);
    this.hairMat.color.setHex(skin.hairColor);
  }

  public setEquipment(helmetLevel: 0 | 1 | 2 | 3, vestLevel: 0 | 1 | 2 | 3, backpackLevel: 0 | 1 | 2 | 3): void {
    this.helmetGroup.visible = helmetLevel > 0;
    if (helmetLevel === 1) this.helmetMat.color.setHex(0x4b5548);
    else if (helmetLevel === 2) this.helmetMat.color.setHex(0x2e353d);
    else if (helmetLevel === 3) this.helmetMat.color.setHex(0x1b1d21);

    this.vestMesh.visible = vestLevel > 0;
    this.vestMesh.scale.setScalar(vestLevel === 3 ? 1.07 : vestLevel === 2 ? 1.03 : 1.0);

    this.backpackGroup.visible = backpackLevel > 0;
    this.backpackGroup.scale.setScalar(backpackLevel === 3 ? 1.18 : backpackLevel === 2 ? 1.0 : 0.82);
  }

  public setWeapon(id: WeaponId | null): void {
    if (id === this.currentWeaponId) return;
    this.currentWeaponId = id;
    if (this.weaponMesh) {
      this.weaponMount.remove(this.weaponMesh);
      this.weaponMesh = null;
    }
    if (id) {
      this.weaponMesh = createWeaponMesh(id);
      this.weaponMount.add(this.weaponMesh);
    }
  }

  public updateAnimation(state: CharacterAnimationState): void {
    const t = state.time;
    const speed = state.moveSpeed;

    this.parachuteGroup.visible = state.isParachuting;
    this.contactShadow.visible = !state.isAirborne && !state.isParachuting && !state.isSkydiving;

    if (state.isSkydiving) {
      this.bodyPivot.rotation.x = -Math.PI / 2.2;
      this.bodyPivot.position.y = 0.8;
      this.leftArmPivot.rotation.set(0.4, 0, -0.9);
      this.rightArmPivot.rotation.set(0.4, 0, 0.9);
      this.leftLegPivot.rotation.set(0.2, 0, -0.18);
      this.rightLegPivot.rotation.set(0.2, 0, 0.18);
      return;
    }

    if (state.isParachuting) {
      this.bodyPivot.rotation.x = Math.sin(t * 2) * 0.05;
      this.bodyPivot.position.y = 0;
      this.leftArmPivot.rotation.set(2.4, 0, -0.2);
      this.rightArmPivot.rotation.set(2.4, 0, 0.2);
      this.leftLegPivot.rotation.set(0.25, 0, 0);
      this.rightLegPivot.rotation.set(0.35, 0, 0);
      return;
    }

    // Normal Ground / Airborne Locomotion
    const crouchOffset = state.isCrouching ? -0.34 : 0;
    const bobFreq = state.isSprinting ? 12 : 8;
    const bobAmp = speed > 0.08 && !state.isAirborne ? (state.isSprinting ? 0.055 : 0.03) : 0.008;
    const breath = Math.sin(t * 2.2) * 0.008;

    this.bodyPivot.position.y = crouchOffset + (speed > 0.08 ? Math.abs(Math.sin(t * bobFreq)) * bobAmp : breath);
    this.bodyPivot.rotation.x = state.isCrouching ? 0.22 : state.isSprinting ? 0.14 : 0.02;

    if (state.isAirborne) {
      this.leftLegPivot.rotation.x = 0.45;
      this.rightLegPivot.rotation.x = -0.35;
    } else if (speed > 0.08) {
      const stride = Math.sin(t * bobFreq) * (state.isSprinting ? 0.82 : 0.56) * Math.min(1.2, speed);
      this.leftLegPivot.rotation.x = stride;
      this.rightLegPivot.rotation.x = -stride;
    } else {
      this.leftLegPivot.rotation.x = state.isCrouching ? -0.35 : 0;
      this.rightLegPivot.rotation.x = state.isCrouching ? 0.25 : 0;
    }

    this.headGroup.rotation.x = THREE.MathUtils.clamp(state.pitch * 0.45, -0.45, 0.45);

    // Weapon holding & reload & recoil pose
    if (this.currentWeaponId) {
      const recoilKick = state.shootRecoil * 0.35;
      const reloadTilt = state.reloadProgress > 0 ? Math.sin(state.reloadProgress * Math.PI) * 0.55 : 0;

      this.rightArmPivot.rotation.set(
        (state.isAds ? 1.48 : 1.24) + state.pitch * 0.55 + recoilKick - reloadTilt,
        -0.18,
        0.06
      );
      this.leftArmPivot.rotation.set(
        (state.isAds ? 1.42 : 1.18) + state.pitch * 0.55 + recoilKick * 0.6 + reloadTilt * 0.6,
        0.48,
        -0.16
      );
    } else {
      const armSwing = speed > 0.08 ? Math.sin(t * bobFreq) * 0.55 : 0;
      this.leftArmPivot.rotation.set(-armSwing, 0, -0.08);
      this.rightArmPivot.rotation.set(armSwing, 0, 0.08);
    }
  }
}
