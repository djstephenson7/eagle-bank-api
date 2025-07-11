import { mockDeep } from "jest-mock-extended";

export const prismaMock = mockDeep();

export const createMockContext = () => {
  return {
    prisma: mockDeep()
  };
};
