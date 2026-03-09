/**
 * Test case: discriminator field duplicate value tuple
 *
 * Content union uses ["type", "subType"] as discriminator fields.
 * TextA and TextB both have type: "text" and subType: "plain", creating a duplicate value tuple.
 */

export interface TextA {
  type: "text";
  subType: "plain";
  bodyA: string;
}

export interface TextB {
  type: "text";
  subType: "plain";
  bodyB: string;
}

export interface MediaJpeg {
  type: "media";
  subType: "jpeg";
  url: string;
}

export type Content = TextA | TextB | MediaJpeg;
