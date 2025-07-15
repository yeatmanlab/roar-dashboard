export interface OrgData {
  districtId?: string;
  id?: string; // Optional for new orgs, assigned by backend
  name: string;
  normalizedName: string;
  parentOrgId?: string;
  parentOrgType?: string;
  schoolId?: string;
  subGroups?: string[];
  tags?: string[];
  type: string;
}
