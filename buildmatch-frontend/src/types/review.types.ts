export interface Review {
  id:           string;
  rating:       number;
  title:        string;
  body:         string;
  reviewerRole: 'INVESTOR' | 'CONTRACTOR';
  createdAt:    string;
  reviewer:     { firstName: string; lastName: string };
  job:          { title: string; tradeType: string } | null;
}

export interface ReviewBreakdown {
  rating: number;
  count:  number;
}

export interface ContractorReviewsResult {
  reviews:    Review[];
  total:      number;
  page:       number;
  totalPages: number;
  breakdown:  ReviewBreakdown[];
}

export interface CreateReviewPayload {
  rating: number;
  title:  string;
  body:   string;
}
