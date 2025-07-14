export interface OrgData {
  districtId?: string;
  id?: string; // Optional for new orgs, assigned by backend
  name: string;
  normalizedName: string;
  parentOrgId?: string;
  schoolId?: string;
  tags?: string[];
  type: string;
}
